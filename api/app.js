const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { recordUsage, getUsageSnapshot } = require('./usage')

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
  ]

  const envPath = candidates.find((p) => fs.existsSync(p))
  if (!envPath) {
    dotenv.config()
    return
  }

  const buf = fs.readFileSync(envPath)
  let content = ''
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    content = buf.toString('utf16le')
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf)
    swapped.swap16()
    content = swapped.toString('utf16le')
  } else {
    const sample = buf.subarray(0, Math.min(buf.length, 256))
    const zeroCount = Array.from(sample).reduce((acc, b) => acc + (b === 0 ? 1 : 0), 0)
    const looksUtf16 = sample.length > 0 && zeroCount / sample.length > 0.2
    content = looksUtf16 ? buf.toString('utf16le') : buf.toString('utf8')
  }

  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)

  const parsed = dotenv.parse(content)
  Object.keys(parsed).forEach((key) => {
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = parsed[key]
  })

  process.env.__ENV_LOADED_FROM = envPath
}

loadEnv()

const PARSE_CACHE_TTL_MS = 5 * 60 * 1000
const PARSE_CACHE_MAX = 200
const parseExpenseCache = new Map()

const normalizeParseKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 500)

const stableHash = (obj) => {
  try {
    const json = JSON.stringify(obj)
    return crypto.createHash('md5').update(json).digest('hex')
  } catch {
    return 'nohash'
  }
}

const buildHierarchyIndex = (hierarchy) => {
  const triples = []
  const exact = new Set()
  const byCatSub = new Map()
  const byCat = new Map()

  hierarchy.forEach((s) => {
    const parts = String(s).split('>')
    const project = (parts[0] || '').trim()
    const category = (parts[1] || '').trim()
    const sub_category = (parts[2] || '').trim()
    if (!project || !category || !sub_category) return
    const key = `${project}>${category}>${sub_category}`
    if (exact.has(key)) return
    exact.add(key)
    const triple = { project, category, sub_category }
    triples.push(triple)

    const cs = `${category}>${sub_category}`
    if (!byCatSub.has(cs)) byCatSub.set(cs, triple)
    if (!byCat.has(category)) byCat.set(category, triple)
  })

  return { triples, exact, byCatSub, byCat, hasAny: triples.length > 0 }
}

const coerceExpenseToHierarchy = (exp, idx) => {
  const safe = {
    project: (exp?.project || '').toString().trim(),
    category: (exp?.category || '').toString().trim(),
    sub_category: (exp?.sub_category || '').toString().trim(),
    amount: Number(exp?.amount),
    expense_date: (exp?.expense_date || '').toString().trim(),
    description: (exp?.description || '').toString().trim(),
    member_name: exp?.member_name ? String(exp.member_name).trim() : null,
    missing_info: Array.isArray(exp?.missing_info) ? exp.missing_info : [],
  }

  if (!safe.project) safe.project = '日常开支'
  if (!safe.category) safe.category = '其他'
  if (!safe.sub_category) safe.sub_category = '其他'
  if (!Number.isFinite(safe.amount)) safe.missing_info.push('amount')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe.expense_date)) safe.expense_date = new Date().toISOString().slice(0, 10)
  if (!safe.description) safe.description = '消费'

  if (!idx.hasAny) return safe

  const key = `${safe.project}>${safe.category}>${safe.sub_category}`
  if (idx.exact.has(key)) return safe

  const csKey = `${safe.category}>${safe.sub_category}`
  const cs = idx.byCatSub.get(csKey)
  if (cs) return { ...safe, project: cs.project }

  const c = idx.byCat.get(safe.category)
  if (c) return { ...safe, project: c.project, sub_category: c.sub_category }

  const fallback = idx.byCatSub.get('其他>其他') || idx.byCat.get('其他')
  if (fallback) return { ...safe, project: fallback.project, category: fallback.category, sub_category: fallback.sub_category }

  return { ...safe, project: '日常开支', category: '其他', sub_category: '其他' }
}

const cacheGet = (key) => {
  const hit = parseExpenseCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > PARSE_CACHE_TTL_MS) {
    parseExpenseCache.delete(key)
    return null
  }
  parseExpenseCache.delete(key)
  parseExpenseCache.set(key, hit)
  return hit.value
}

const cacheSet = (key, value) => {
  parseExpenseCache.set(key, { at: Date.now(), value })
  if (parseExpenseCache.size > PARSE_CACHE_MAX) {
    const firstKey = parseExpenseCache.keys().next().value
    if (firstKey) parseExpenseCache.delete(firstKey)
  }
}

const app = express()

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/api/ai/health', (req, res) => {
  const deepseekConfigured = !!process.env.DEEPSEEK_API_KEY
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  res.status(200).json({
    success: true,
    deepseekConfigured,
    openaiConfigured: deepseekConfigured || openaiConfigured,
    provider: deepseekConfigured ? 'deepseek' : openaiConfigured ? 'openai' : 'none',
    model: deepseekConfigured
      ? (process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat')
      : (process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'),
  })
})

app.get('/api/ai/debug-env', (req, res) => {
  const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
  const openaiKey = process.env.OPENAI_API_KEY || ''

  const mask = (v) => {
    if (!v) return { present: false }
    const s = String(v)
    return {
      present: true,
      length: s.length,
      last4: s.length >= 4 ? s.slice(-4) : s,
    }
  }

  res.status(200).json({
    success: true,
    loadedFrom: process.env.__ENV_LOADED_FROM || null,
    deepseek: mask(deepseekKey),
    openai: mask(openaiKey),
  })
})

app.get('/api/ai/usage', (req, res) => {
  res.status(200).json({ success: true, data: getUsageSnapshot() })
})

app.post('/api/ai/reload-env', (req, res) => {
  loadEnv()
  const deepseekConfigured = !!process.env.DEEPSEEK_API_KEY
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  res.status(200).json({
    success: true,
    deepseekConfigured,
    openaiConfigured,
    provider: deepseekConfigured ? 'deepseek' : openaiConfigured ? 'openai' : 'none',
  })
})

app.post('/api/ai/parse-expense', async (req, res) => {
  const startedAt = Date.now()
  let provider = 'none'
  const text = (req.body && typeof req.body.text === 'string' ? req.body.text : '').trim()
  if (!text) {
    recordUsage({ provider: 'none', endpoint: 'parse-expense', ok: false, ms: Date.now() - startedAt })
    res.status(400).json({ success: false, error: 'Invalid body' })
    return
  }

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY
  provider = deepseekApiKey ? 'deepseek' : openaiApiKey ? 'openai' : 'none'
  console.log(`[ai/parse-expense] provider=${provider}`)

  const ctx = (req.body && req.body.context) || {}
  const hierarchy = Array.isArray(ctx.hierarchy) ? ctx.hierarchy.slice(0, 120) : []
  const members = Array.isArray(ctx.members) ? ctx.members.slice(0, 50) : []
  const ctxHash = stableHash({ hierarchy, members })

  const hierarchyIndex = buildHierarchyIndex(hierarchy)

  const cacheKey = `${normalizeParseKey(text)}|${ctxHash}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    recordUsage({ provider: cached.provider || provider, endpoint: 'parse-expense', ok: true, ms: Date.now() - startedAt })
    res.status(200).json({ success: true, expenses: cached.expenses, provider: cached.provider || provider })
    return
  }

  if (provider === 'none') {
    recordUsage({ provider: 'none', endpoint: 'parse-expense', ok: false, ms: Date.now() - startedAt })
    res.status(500).json({
      success: false,
      error: 'No LLM API key configured. Set DEEPSEEK_API_KEY (recommended) or OPENAI_API_KEY in .env and restart the API server.',
    })
    return
  }

  const client = new OpenAI({
    apiKey: provider === 'deepseek' ? deepseekApiKey : openaiApiKey,
    baseURL:
      provider === 'deepseek'
        ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
        : (process.env.OPENAI_BASE_URL || undefined),
  })

  try {
    const system =
      'You are an expense parser. Return JSON only. Output format: {"expenses": [...]}. Each expense must include fields: ' +
      'project, category, sub_category, amount, expense_date (YYYY-MM-DD), description, member_name, missing_info.'

    const user =
      `文本: "${text}"\n` +
      `当前日期: ${new Date().toISOString().slice(0, 10)}\n` +
      (hierarchy.length ? `已存在分类(项目>分类>子分类)，必须从中选择：${hierarchy.join('；')}\n` : '') +
      (members.length ? `现有成员：[${members.join(', ')}]\n` : '') +
      `规则：\n` +
      `1) project/category/sub_category 必须从已存在分类中选择；找不到则用 project=\"日常开支\", category=\"其他\", sub_category=\"其他\"。\n` +
      `2) 可能包含 OCR 乱码，忽略无关信息。\n` +
      `3) 如果包含多笔消费，必须拆分为多条 expenses。\n` +
      `4) 只输出 JSON 对象，不要 Markdown。`

    const completion = await client.chat.completions.create({
      model:
        provider === 'deepseek'
          ? (process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat')
          : (process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const content = (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonText = (jsonMatch ? jsonMatch[0] : content).trim()
    const raw = JSON.parse(jsonText)
    const list = Array.isArray(raw?.expenses) ? raw.expenses : (raw?.amount ? [raw] : [])
    const expenses = list.map((e) => coerceExpenseToHierarchy(e, hierarchyIndex))

    recordUsage({ provider, endpoint: 'parse-expense', ok: true, ms: Date.now() - startedAt })
    cacheSet(cacheKey, { provider, expenses })
    res.status(200).json({ success: true, expenses, provider })
  } catch (e) {
    recordUsage({ provider, endpoint: 'parse-expense', ok: false, ms: Date.now() - startedAt })
    res.status(500).json({ success: false, error: 'Failed to parse expense' })
  }
})

app.post('/api/ai/transcribe', async (req, res) => {
  const audioBase64 = (req.body && typeof req.body.audioBase64 === 'string' ? req.body.audioBase64 : '').trim()
  const fileName = (req.body && typeof req.body.fileName === 'string' ? req.body.fileName : 'audio.wav').trim() || 'audio.wav'
  const language = (req.body && typeof req.body.language === 'string' ? req.body.language : 'zh').trim() || 'zh'

  if (!audioBase64) {
    res.status(400).json({ success: false, error: 'Invalid body' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' })
    return
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })

  const tmpPath = path.join(os.tmpdir(), `trae-audio-${crypto.randomUUID()}-${fileName}`)
  try {
    const buffer = Buffer.from(audioBase64, 'base64')
    fs.writeFileSync(tmpPath, buffer)

    const result = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
      file: fs.createReadStream(tmpPath),
      language,
    })

    res.status(200).json({ success: true, text: result.text })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to transcribe audio' })
  } finally {
    try {
      fs.unlinkSync(tmpPath)
    } catch {
    }
  }
})

app.post('/api/ai/recognize-image', async (req, res) => {
  const imageBase64 = (req.body && typeof req.body.imageBase64 === 'string' ? req.body.imageBase64 : '').trim()
  const mimeType = (req.body && typeof req.body.mimeType === 'string' ? req.body.mimeType : 'image/jpeg').trim() || 'image/jpeg'

  if (!imageBase64) {
    res.status(400).json({ success: false, error: 'Invalid body' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' })
    return
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract and return only the text content from the image.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this receipt/image.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0,
    })

    const text = completion.choices?.[0]?.message?.content || ''
    res.status(200).json({ success: true, text })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to recognize image' })
  }
})

app.use('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ok' })
})

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'API not found' })
})

module.exports = app
