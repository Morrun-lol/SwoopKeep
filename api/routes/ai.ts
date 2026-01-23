import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'
import { z } from 'zod'
import { toFile } from 'openai/uploads'
import { recordUsage, getUsageSnapshot } from '../usage.js'

const router = Router()

const PARSE_CACHE_TTL_MS = 5 * 60 * 1000
const PARSE_CACHE_MAX = 200
const parseExpenseCache = new Map<string, { at: number; value: { provider: string; data: any } }>()

const normalizeParseKey = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 500)

const cacheGet = (key: string) => {
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

const cacheSet = (key: string, value: { provider: string; data: any }) => {
  parseExpenseCache.set(key, { at: Date.now(), value })
  if (parseExpenseCache.size > PARSE_CACHE_MAX) {
    const firstKey = parseExpenseCache.keys().next().value
    if (firstKey) parseExpenseCache.delete(firstKey)
  }
}

const buildHierarchyIndex = (hierarchy: string[]) => {
  const exact = new Set<string>()
  const byCatSub = new Map<string, { project: string; category: string; sub_category: string }>()
  const byCat = new Map<string, { project: string; category: string; sub_category: string }>()

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
    const cs = `${category}>${sub_category}`
    if (!byCatSub.has(cs)) byCatSub.set(cs, triple)
    if (!byCat.has(category)) byCat.set(category, triple)
  })

  return { exact, byCatSub, byCat, hasAny: exact.size > 0 }
}

const coerceExpenseToHierarchy = (
  exp: any,
  idx: ReturnType<typeof buildHierarchyIndex>
): {
  project: string
  category: string
  sub_category: string
  amount: number
  expense_date: string
  description: string
  member_name: string | null
  missing_info: any[]
} => {
  const safe = {
    project: (exp?.project || '').toString().trim() || '日常开支',
    category: (exp?.category || '').toString().trim() || '其他',
    sub_category: (exp?.sub_category || '').toString().trim() || '其他',
    amount: Number(exp?.amount),
    expense_date: (exp?.expense_date || '').toString().trim(),
    description: (exp?.description || '').toString().trim() || '消费',
    member_name: exp?.member_name ? String(exp.member_name).trim() : null,
    missing_info: Array.isArray(exp?.missing_info) ? exp.missing_info : [],
  }

  if (!Number.isFinite(safe.amount)) safe.missing_info.push('amount')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe.expense_date)) safe.expense_date = new Date().toISOString().slice(0, 10)

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

router.get('/health', (req: Request, res: Response): void => {
  const deepseekConfigured = !!process.env.DEEPSEEK_API_KEY
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  res.status(200).json({
    success: true,
    deepseekConfigured,
    openaiConfigured: deepseekConfigured || openaiConfigured,
    provider: deepseekConfigured ? 'deepseek' : openaiConfigured ? 'openai' : 'none',
  })
})

router.get('/usage', (req: Request, res: Response): void => {
  res.status(200).json({ success: true, data: getUsageSnapshot() })
})

const parseExpenseBodySchema = z.object({
  text: z.string().min(1),
  context: z
    .object({
      hierarchy: z.array(z.string()).optional(),
      members: z.array(z.string()).optional(),
    })
    .optional(),
})

router.post('/parse-expense', async (req: Request, res: Response): Promise<void> => {
  const startedAt = Date.now()
  const parsedBody = parseExpenseBodySchema.safeParse(req.body)
  if (!parsedBody.success) {
    recordUsage({ provider: 'none', endpoint: 'parse-expense', ok: false, ms: Date.now() - startedAt })
    res.status(400).json({ success: false, error: 'Invalid body' })
    return
  }

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY
  const provider = deepseekApiKey ? 'deepseek' : openaiApiKey ? 'openai' : 'none'

  const hierarchy = parsedBody.data.context?.hierarchy?.slice(0, 120) || []
  const members = parsedBody.data.context?.members?.slice(0, 50) || []
  const hierarchyIndex = buildHierarchyIndex(hierarchy)
  const ctxKey = JSON.stringify({ hierarchy, members })
  const cacheKey = `${normalizeParseKey(parsedBody.data.text)}|${ctxKey}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    recordUsage({ provider: cached.provider || provider, endpoint: 'parse-expense', ok: true, ms: Date.now() - startedAt })
    res.status(200).json({ success: true, expenses: cached.data, provider: cached.provider || provider })
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
    apiKey: provider === 'deepseek' ? deepseekApiKey! : openaiApiKey!,
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
      `文本: "${parsedBody.data.text}"\n` +
      `当前日期: ${new Date().toISOString().slice(0, 10)}\n` +
      (hierarchy.length ? `已存在分类(项目>分类>子分类)，必须从中选择：${hierarchy.join('；')}\n` : '') +
      (members.length ? `现有成员：[${members.join(', ')}]\n` : '') +
      `规则：\n` +
      `1) project/category/sub_category 必须从已存在分类中选择；找不到则用 project=\"日常开支\", category=\"其他\", sub_category=\"其他\"。\n` +
      `2) 忽略 OCR 乱码。\n` +
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

    const content = completion.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonText = (jsonMatch ? jsonMatch[0] : content).trim()
    const raw = JSON.parse(jsonText)
    const list = Array.isArray(raw?.expenses) ? raw.expenses : (raw?.amount ? [raw] : [])
    const expenses = list.map((e: any) => coerceExpenseToHierarchy(e, hierarchyIndex))
    recordUsage({ provider, endpoint: 'parse-expense', ok: true, ms: Date.now() - startedAt })
    cacheSet(cacheKey, { provider, data: expenses })
    res.status(200).json({ success: true, expenses, provider })
  } catch (e: any) {
    recordUsage({ provider, endpoint: 'parse-expense', ok: false, ms: Date.now() - startedAt })
    res.status(500).json({
      success: false,
      error: e?.message ? String(e.message) : 'Failed to parse expense',
      provider,
    })
  }
})

const transcribeBodySchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  language: z.string().optional(),
})

router.post('/transcribe', async (req: Request, res: Response): Promise<void> => {
  const parsedBody = transcribeBodySchema.safeParse(req.body)
  if (!parsedBody.success) {
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
    const buffer = Buffer.from(parsedBody.data.audioBase64, 'base64')
    const fileName = parsedBody.data.fileName || 'audio.wav'
    const mimeType = parsedBody.data.mimeType || 'audio/wav'
    const file = await toFile(buffer, fileName, { type: mimeType })

    const result = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
      file,
      language: parsedBody.data.language || 'zh',
    })

    res.status(200).json({ success: true, text: result.text })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message ? String(e.message) : 'Failed to transcribe audio' })
  }
})

const recognizeImageBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
})

router.post('/recognize-image', async (req: Request, res: Response): Promise<void> => {
  const parsedBody = recognizeImageBodySchema.safeParse(req.body)
  if (!parsedBody.success) {
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
    const mimeType = parsedBody.data.mimeType || 'image/jpeg'
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
              image_url: { url: `data:${mimeType};base64,${parsedBody.data.imageBase64}` },
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

export default router
