import OpenAI from 'openai'
import { app } from 'electron'
import { setGlobalDispatcher, ProxyAgent, Agent, fetch } from 'undici'
import { net } from 'electron'
import { getExpenseStructure } from './expense'
import { getAllMembers } from './family'

// 标记代理是否已配置
let isProxyConfigured = false

function initProxy() {
  // ... (Keep existing logic if needed, or ignore since it's not used)
}

// DeepSeek 配置
const getDeepSeekApiKey = () => process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

let openaiClient: OpenAI | null = null

function getOpenAIClient() {
  if (openaiClient) return openaiClient
  
  const apiKey = getDeepSeekApiKey()
  if (!apiKey) {
     throw new Error('DeepSeek API Key 未配置')
  }

  openaiClient = new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: apiKey
  })
  return openaiClient
}

// 移除后端语音转文本功能，改由前端科大讯飞 WebSocket 实现
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  throw new Error('Please use frontend Xunfei WebSocket implementation.')
}

// 辅助函数：检测本地端口是否开放
function checkLocalPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)()
    socket.setTimeout(200) // 快速超时
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.connect(port, '127.0.0.1')
  })
}

// 自动探测代理端口
async function detectProxyPort(): Promise<string | null> {
  const commonPorts = [7890, 10809, 1080, 8080, 8888, 4780, 7891, 10808]
  for (const port of commonPorts) {
    if (await checkLocalPort(port)) {
      console.log(`[LLM] Detected active local proxy port: ${port}`)
      return `http://127.0.0.1:${port}`
    }
  }
  return null
}

export interface LLMConfig {
    provider: 'openai' | 'gemini' | 'deepseek' | 'local'
    apiKey: string
    baseUrl?: string
    model?: string
}

// 缓存网络状态 (5分钟有效)
let networkStatusCache: {
    timestamp: number
    status: {
        baidu: boolean
        google: boolean
        googleApi: boolean
        openai: boolean
        gemini: boolean
        proxy: string
        error?: string
    }
} | null = null

async function getCachedNetworkStatus() {
    const now = Date.now()
    if (networkStatusCache && (now - networkStatusCache.timestamp < 5 * 60 * 1000)) {
        return networkStatusCache.status
    }
    const status = await checkConnection()
    networkStatusCache = { timestamp: now, status }
    return status
}

/**
 * 智能选择最佳 LLM
 * 策略：
 * 1. 任务类型 (ocr | text)
 * 2. 网络连通性
 * 3. Key 配置情况
 */
export async function selectBestModel(task: 'ocr' | 'text'): Promise<LLMConfig> {
    const status = await getCachedNetworkStatus()
    
    const openAiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const deepSeekKey = process.env.DEEPSEEK_API_KEY

    // --- OCR 任务策略 ---
    if (task === 'ocr') {
        // 1. 首选 OpenAI Vision (如果 Key 存在且 API 通)
        // 注意：status.openai 为 true 表示连接通，或者如果未配置 key 则可能为 false。
        // 这里我们更关心 connectivity。
        // checkConnection 中 openai=true 意味着 fetch 成功且 key 有效。
        if (openAiKey && status.openai) {
            return { provider: 'openai', apiKey: openAiKey, model: 'gpt-4o' }
        }
        
        // 2. 次选 Gemini Vision (免费且强大)
        if (geminiKey && status.gemini) {
            return { provider: 'gemini', apiKey: geminiKey, model: 'gemini-1.5-flash' }
        }
        
        // 3. 再次选 OpenAI (如果 Key 存在，但 checkConnection 之前失败可能是偶发，或者 connectivity OK 但 key 验证未通过? 
        // 假设 checkConnection 比较准。
        // 如果有 key 但 status.openai 为 false (可能是超时)，可以再试一次？
        // 为了稳健，如果 proxy 存在且有 key，也可以尝试。
        if (openAiKey && status.google) { // 如果能连上 Google，通常也能连上 OpenAI (通过代理)
             return { provider: 'openai', apiKey: openAiKey, model: 'gpt-4o' }
        }

        // 4. 本地回退
        return { provider: 'local', apiKey: '' }
    }

    // --- 文本解析任务策略 ---
    if (task === 'text') {
        // 1. 首选 DeepSeek (国内直连，速度快，便宜/免费额度)
        if (deepSeekKey) {
             // DeepSeek 不需要翻墙，通常总是可用的
             return { provider: 'deepseek', apiKey: deepSeekKey, model: 'deepseek-chat' }
        }

        // 2. 次选 OpenAI (如果 DeepSeek 没配置)
        if (openAiKey && (status.openai || status.google)) {
             return { provider: 'openai', apiKey: openAiKey, model: 'gpt-4o-mini' } // mini 省钱且够用
        }

        // 3. 次选 Gemini
        if (geminiKey && (status.gemini || status.google)) {
             return { provider: 'gemini', apiKey: geminiKey, model: 'gemini-1.5-flash' }
        }
    }

    // 默认回退 (如果没有配置任何 Key，文本解析可能会失败)
    // 抛出明确错误或尝试本地模型(未实现)
    throw new Error('未配置有效的 AI 服务 (DeepSeek/OpenAI/Gemini)，请在 .env 文件中配置 API Key。')
}

export async function checkConnection(): Promise<{
  baidu: boolean;
  google: boolean;
  googleApi: boolean;
  openai: boolean;
  gemini: boolean;
  proxy: string;
  error?: string;
}> {
  // Use local agents instead of global dispatcher to avoid side effects
  
  let proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  
  if (!proxyUrl) {
    const detected = await detectProxyPort()
    if (detected) {
      proxyUrl = detected
    }
  }

  const results = {
    baidu: false,
    google: false,
    googleApi: false,
    openai: false,
    gemini: false,
    proxy: proxyUrl || '未检测到有效代理',
    error: ''
  }

  // Agent for direct connection (Baidu)
  const directAgent = new Agent({
    connect: { timeout: 5000 }
  })

  // Agent for proxy connection (Google)
  let googleDispatcher: Agent | ProxyAgent = directAgent
  if (proxyUrl) {
    try {
      googleDispatcher = new ProxyAgent({
        uri: proxyUrl,
        connect: {
          timeout: 10000,
          rejectUnauthorized: false
        }
      })
    } catch (e: any) {
      console.error('Failed to create proxy agent:', e)
      results.error += `Proxy Config Error: ${e.message}; `
    }
  }

  // 1. Check Baidu (Direct)
  try {
    const baiduRes = await fetch('https://www.baidu.com', { 
      method: 'HEAD', 
      dispatcher: directAgent,
      signal: AbortSignal.timeout(5000)
    })
    results.baidu = baiduRes.ok
  } catch (e) {
    console.error('Baidu check failed:', e)
  }

  // 2. Check Google (Proxy)
  try {
    const googleRes = await fetch('https://www.google.com', { 
      method: 'HEAD', 
      dispatcher: googleDispatcher,
      signal: AbortSignal.timeout(10000)
    })
    results.google = googleRes.ok
  } catch (e: any) {
    console.error('Google check failed:', e)
    results.error += `Google: ${e.message}; `
  }

  // 3. Check Google API (Proxy)
  try {
    const apiRes = await fetch('https://generativelanguage.googleapis.com', { 
      method: 'GET', 
      dispatcher: googleDispatcher,
      signal: AbortSignal.timeout(10000)
    })
    // 404 means we reached the server (path not found), which confirms connectivity
    results.googleApi = apiRes.ok || apiRes.status === 404
  } catch (e: any) {
    console.error('Google API check failed:', e)
    results.error += `API: ${e.message}`
  }

  // 4. Check OpenAI API (Proxy/Direct)
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/models', { 
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
      },
      dispatcher: googleDispatcher,
      signal: AbortSignal.timeout(10000)
    })
    // 200 OK means key is valid and connection works
    // 401 means connection works but key invalid
    if (openaiRes.ok) {
        // OpenAI success
        console.log('[LLM] OpenAI check passed')
        results.openai = true
    } else if (openaiRes.status === 401) {
        results.error += `OpenAI: Invalid Key; `
    } else {
        results.error += `OpenAI: ${openaiRes.status} ${openaiRes.statusText}; `
    }
  } catch (e: any) {
    console.error('OpenAI check failed:', e)
    results.error += `OpenAI: ${e.message}; `
  }

  // 5. Check Gemini API (Proxy)
  try {
    const geminiKey = process.env.GEMINI_API_KEY || ''
    // If no key, we can still check connectivity to the endpoint
    // If key exists, we can try to list models
    const url = geminiKey 
        ? `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
        : 'https://generativelanguage.googleapis.com/v1beta/models' // This will fail auth but confirm connectivity
    
    const geminiRes = await fetch(url, { 
      method: 'GET', 
      dispatcher: googleDispatcher,
      signal: AbortSignal.timeout(10000)
    })
    
    if (geminiRes.ok) {
        console.log('[LLM] Gemini check passed')
        results.gemini = true
    } else if (geminiRes.status === 400 && !geminiKey) {
        // 400 Bad Request usually means missing API key, which implies connectivity is fine
        // But we want to know if it's usable. If no key, it's not usable.
        // So we only set true if res.ok
        results.error += `Gemini: Missing Key; `
    } else if (geminiRes.status === 403 || geminiRes.status === 401) {
         // Auth failed
         results.error += `Gemini: Invalid Key; `
    } else {
         results.error += `Gemini: ${geminiRes.status}; `
    }
  } catch (e: any) {
    console.error('Gemini check failed:', e)
    results.error += `Gemini: ${e.message}; `
  }

  return results
}


const PARSE_CACHE_TTL_MS = 5 * 60 * 1000
const PARSE_CACHE_MAX = 200
const parseExpenseCache = new Map<string, { at: number; value: any }>()

const SELECT_CACHE_TTL_MS = 60 * 1000
let selectModelCache: { at: number; value: any } = { at: 0, value: null }

const normalizeParseKey = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 500)

const normToken = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '')

const bigrams = (s: string) => {
  if (s.length < 2) return [] as string[]
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

const diceSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0
  if (a === b) return 1
  const ba = bigrams(a)
  const bb = bigrams(b)
  if (!ba.length || !bb.length) return 0
  const map = new Map<string, number>()
  for (const x of ba) map.set(x, (map.get(x) || 0) + 1)
  let inter = 0
  for (const y of bb) {
    const c = map.get(y) || 0
    if (c > 0) {
      map.set(y, c - 1)
      inter++
    }
  }
  return (2 * inter) / (ba.length + bb.length)
}

const buildHierarchyIndex = (structure: any[]) => {
  const triples: Array<{ project: string; category: string; sub_category: string; _nPair: string; _nFull: string; _nCategory: string; _nSub: string }> = []
  const exact = new Set<string>()
  const byCatSub = new Map<string, { project: string; category: string; sub_category: string }>()
  const byCat = new Map<string, { project: string; category: string; sub_category: string }>()

  for (const row of structure || []) {
    const project = String(row?.project || '').trim() || '日常开支'
    const category = String(row?.category || '').trim()
    const sub_category = String(row?.sub_category || '').trim()
    if (!category || !sub_category) continue
    const key = `${project}>${category}>${sub_category}`
    if (exact.has(key)) continue
    exact.add(key)
    const triple = {
      project,
      category,
      sub_category,
      _nCategory: normToken(category),
      _nSub: normToken(sub_category),
      _nPair: `${normToken(category)}>${normToken(sub_category)}`,
      _nFull: `${normToken(project)}>${normToken(category)}>${normToken(sub_category)}`,
    }
    triples.push(triple)
    const cs = `${category}>${sub_category}`
    if (!byCatSub.has(cs)) byCatSub.set(cs, triple)
    if (!byCat.has(category)) byCat.set(category, triple)
  }

  if (!exact.has('日常开支>其他>其他')) {
    const t = {
      project: '日常开支',
      category: '其他',
      sub_category: '其他',
      _nCategory: normToken('其他'),
      _nSub: normToken('其他'),
      _nPair: `${normToken('其他')}>${normToken('其他')}`,
      _nFull: `${normToken('日常开支')}>${normToken('其他')}>${normToken('其他')}`,
    }
    triples.unshift(t)
    exact.add('日常开支>其他>其他')
    byCatSub.set('其他>其他', t)
    byCat.set('其他', t)
  }

  return { triples, exact, byCatSub, byCat, hasAny: triples.length > 0 }
}

const coerceToHierarchy = (exp: any, idx: ReturnType<typeof buildHierarchyIndex>) => {
  const safe = {
    project: String(exp?.project || '').trim() || '日常开支',
    category: String(exp?.category || '').trim() || '其他',
    sub_category: String(exp?.sub_category || '').trim() || '其他',
  }

  if (!idx.hasAny) return { ...exp, ...safe }

  const key = `${safe.project}>${safe.category}>${safe.sub_category}`
  if (idx.exact.has(key)) return { ...exp, ...safe }

  const cs = idx.byCatSub.get(`${safe.category}>${safe.sub_category}`)
  if (cs) return { ...exp, ...safe, project: cs.project }

  const c = idx.byCat.get(safe.category)
  if (c) return { ...exp, ...safe, project: c.project, sub_category: c.sub_category }

  const threshold = Number(process.env.PARSE_MATCH_THRESHOLD || process.env.SEMANTIC_MATCH_THRESHOLD || '0.72')
  const nPair = `${normToken(safe.category)}>${normToken(safe.sub_category)}`
  const nFull = `${normToken(safe.project)}>${normToken(safe.category)}>${normToken(safe.sub_category)}`
  let best: any = null
  let bestScore = 0
  for (const t of idx.triples) {
    const score = Math.max(
      diceSimilarity(nPair, t._nPair),
      diceSimilarity(nFull, t._nFull),
      0.6 * diceSimilarity(normToken(safe.category), t._nCategory) + 0.4 * diceSimilarity(normToken(safe.sub_category), t._nSub),
    )
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  if (best && bestScore >= threshold) {
    return { ...exp, ...safe, project: best.project, category: best.category, sub_category: best.sub_category }
  }

  return { ...exp, project: '日常开支', category: '其他', sub_category: '其他' }
}

const parseCacheGet = (key: string) => {
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

const parseCacheSet = (key: string, value: any) => {
  parseExpenseCache.set(key, { at: Date.now(), value })
  if (parseExpenseCache.size > PARSE_CACHE_MAX) {
    const firstKey = parseExpenseCache.keys().next().value
    if (firstKey) parseExpenseCache.delete(firstKey)
  }
}

export async function parseExpense(text: string): Promise<any> {
  const cacheKey = normalizeParseKey(text)
  const cached = parseCacheGet(cacheKey)
  if (cached) return cached

  // 使用智能选择策略
  let llmConfig
  try {
      if (selectModelCache.value && Date.now() - selectModelCache.at < SELECT_CACHE_TTL_MS) {
          llmConfig = selectModelCache.value
      } else {
          llmConfig = await selectBestModel('text')
          selectModelCache = { at: Date.now(), value: llmConfig }
      }
  } catch (e) {
      console.warn('Smart select failed, falling back to DeepSeek check:', e)
      llmConfig = { provider: 'deepseek', apiKey: getDeepSeekApiKey() }
  }

  const today = new Date().toISOString().split('T')[0]
  
  // 获取现有的分类结构和成员列表
  let categoryHint = '如：餐饮、交通、购物、娱乐、医疗、教育、住房、其他'
  let memberHint = ''
  let members: any[] = []
  let hierarchyIndex = buildHierarchyIndex([])

  try {
      const structure = getExpenseStructure()
      if (structure && structure.length > 0) {
          const items = structure.map(s => `${s.project || '无项目'}>${s.category}>${s.sub_category || '无子分类'}`)
          const maxItems = 120
          const clipped = items.slice(0, maxItems)
          const suffix = items.length > clipped.length ? '；...' : ''
          categoryHint = `已存在分类(项目>分类>子分类)，必须从中选择：${clipped.join('；')}${suffix}`
      }

      hierarchyIndex = buildHierarchyIndex(structure || [])
      
      members = getAllMembers()
      if (members.length > 0) {
          memberHint = `现有家庭成员：[${members.map(m => m.name).join(', ')}]`
      }
  } catch (e) {
      console.warn('Failed to get context for prompt:', e)
  }

  const prompt = `你是记账语义解析器，输出 JSON 对象 {"expenses": [...]}。

文本: "${text}"
当前日期: ${today}
${categoryHint}
${memberHint}

规则：
1) project/category/sub_category 必须从已有分类体系选择；找不到则用 "日常开支" > "其他" > "其他"。
2) 忽略 OCR 乱码与无关信息；支持多笔拆分。
3) 只输出 JSON，不要 Markdown。`
  
  try {
    let rawContent = '{}'
    
    if (llmConfig.provider === 'deepseek') {
        const apiKey = llmConfig.apiKey.trim();
        const openai = new OpenAI({
            baseURL: DEEPSEEK_BASE_URL,
            apiKey: apiKey,
            // @ts-ignore
            // @ts-ignore
            httpAgent: (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) ? new ProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY) : undefined
        })
        const completion = await openai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
            { role: 'user', content: prompt }
          ],
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
        })
        rawContent = completion.choices[0].message.content || '{}'
        
    } else if (llmConfig.provider === 'openai') {
        const openai = new OpenAI({
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            apiKey: llmConfig.apiKey,
            // @ts-ignore
            httpAgent: (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) ? new ProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY) : undefined
        })
        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            model: llmConfig.model || 'gpt-4o-mini',
            response_format: { type: 'json_object' }
        })
        rawContent = completion.choices[0].message.content || '{}'
        
    } else if (llmConfig.provider === 'gemini') {
         // Simple Gemini implementation via REST or OpenAI-compat if possible
         // Gemini API is different. Let's use simple fetch for now or install google-generative-ai
         // Using fetch to avoid adding heavy deps if possible, but structure is complex.
         // Actually, Gemini supports OpenAI compatibility on some endpoints? No.
         // Let's fallback to fetch.
         
         const url = `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`
         const body = {
             contents: [{ parts: [{ text: prompt + "\nResponse must be valid JSON." }] }]
         }
         
         // Use dispatcher for proxy
         let dispatcher = undefined
         const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
         if (proxyUrl) {
             dispatcher = new ProxyAgent({ uri: proxyUrl, connect: { timeout: 10000, rejectUnauthorized: false } })
         }
         
         const res = await fetch(url, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(body),
             dispatcher
         })
         
         if (!res.ok) throw new Error(`Gemini API Error: ${res.statusText}`)
         
         const data: any = await res.json()
         const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
         // Gemini often wraps JSON in ```json ... ```
         rawContent = text
    }

    

    // 去除可能存在的 Markdown 代码块标记
    const jsonStr = rawContent.replace(/```json\n?|\n?```/g, '').trim()
    
    let result
    try {
        result = JSON.parse(jsonStr)
    } catch (e) {
        console.error('JSON Parse Error:', e)
        throw new Error(`解析 JSON 失败: ${rawContent.substring(0, 100)}...`)
    }
    
    let parsedExpenses = []
    // 兼容旧格式（如果 AI 偶尔只返回单个对象，虽然 prompt 要求了数组）
    if (result.expenses && Array.isArray(result.expenses)) {
        parsedExpenses = result.expenses
    } else if (result.amount) {
        // Fallback for single object
        parsedExpenses = [result]
    }
    
    // 自动匹配 member_id
    if (members.length > 0) {
        parsedExpenses = parsedExpenses.map((exp: any) => {
            if (exp.member_name) {
                // 模糊匹配：如果 member_name 包含在成员列表中，或者成员名包含 member_name
                const matchedMember = members.find((m: any) => m.name === exp.member_name || m.name.includes(exp.member_name) || exp.member_name.includes(m.name))
                if (matchedMember) {
                    exp.member_id = matchedMember.id
                }
            }
            return exp
        })
    }

    parsedExpenses = parsedExpenses.map((exp: any) => coerceToHierarchy(exp, hierarchyIndex))
    
    // 返回结果时，顺便带上使用的 LLM 信息 (需要修改返回类型，或者前端单独获取)
    // 为了不破坏现有接口，我们可以在 expenses 数组对象之外包一层？
    // 或者，我们可以在第一个 expense 对象中注入 metadata? (不太好)
    // 最好的方式是修改返回值类型 Promise<any> -> Promise<{expenses: any[], provider: string}>
    // 但是前端调用处需要适配。
    // 简单起见，我们暂时把 provider 信息放在数组的第一个元素的一个特殊字段里？
    // 或者直接修改 ipcMain handler 返回结构。
    
    // Let's modify the return structure to include provider info.
    // Front-end expects array of expenses.
    // We can attach a non-enumerable property? No, IPC serialization will lose it.
    // We can change the return to { expenses: [...], provider: '...' }
    // But we need to check where parseExpense is called.
    
    const finalResult = { expenses: parsedExpenses, provider: llmConfig.provider }
    parseCacheSet(cacheKey, finalResult)
    return finalResult

  } catch (error: any) {
    console.error('Parsing error:', error)
    if (error.status === 402 || (error.message && error.message.includes('402'))) {
      throw new Error('API 余额不足，请检查对应服务商账户。')
    }
    throw new Error(`语义解析失败 (${llmConfig.provider}): ${error.message}`)
  }
}
