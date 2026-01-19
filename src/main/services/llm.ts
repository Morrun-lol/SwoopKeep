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


export async function parseExpense(text: string): Promise<any> {
  // 使用智能选择策略
  let llmConfig
  try {
      llmConfig = await selectBestModel('text')
  } catch (e) {
      console.warn('Smart select failed, falling back to DeepSeek check:', e)
      llmConfig = { provider: 'deepseek', apiKey: getDeepSeekApiKey() }
  }

  const today = new Date().toISOString().split('T')[0]
  
  // 获取现有的分类结构和成员列表
  let categoryHint = '如：餐饮、交通、购物、娱乐、医疗、教育、住房、其他'
  let memberHint = ''
  let members: any[] = []

  try {
      const structure = getExpenseStructure()
      if (structure && structure.length > 0) {
          // 格式化为：项目 > 分类 > 子分类
          const items = structure.map(s => `${s.project || '无项目'} > ${s.category} > ${s.sub_category || '无子分类'}`)
          // 限制长度，防止 prompt 过长
          if (items.length > 200) {
             categoryHint = '请从用户已有的分类体系中选择最匹配的项目、分类和子分类。'
          } else {
             categoryHint = `请优先从以下已存在的分类体系中选择（格式：项目 > 分类 > 子分类）：\n${items.join('\n')}`
          }
      }
      
      members = getAllMembers()
      if (members.length > 0) {
          memberHint = `现有家庭成员：[${members.map(m => m.name).join(', ')}]`
      }
  } catch (e) {
      console.warn('Failed to get context for prompt:', e)
  }

  const prompt = `
  你是一个智能记账助手。以下文本可能来自用户的语音输入，也可能来自小票图片的 OCR 识别结果（因此可能包含大量无意义的字符、乱码或排版混乱）。
  
  请忽略文本中的乱码和无关信息，尽力提取出关键的消费信息。
  
  文本: "${text}"
  
  当前日期: ${today}
  
  ${categoryHint}
  ${memberHint}
  
  **分类规则（严格执行）：**
  1. 请**必须**从上述已存在的分类体系中选择最匹配的 "project" (项目), "category" (分类) 和 "sub_category" (子分类)。
  2. 如果无法在现有体系中找到匹配项，请将其归类为 "日常开支" > "其他" > "其他"。
  3. **严禁**创造用户现有体系之外的新分类名称，除非文本中极其明确地指出了一个新的分类结构（这种可能性极低）。
  
  请分析文本中包含的一笔或多笔消费记录。
  
  **重要处理规则：**
  1. **OCR 纠错**：如果文本看起来像 OCR 结果（包含无意义符号），请尝试从中识别出 日期（如 202x-xx-xx）、金额（如 123.00, 123.5）、商户名称（如xx餐饮、xx超市）等关键模式。
  2. **多笔拆分**：如果文本中包含多个独立的消费事件（例如“买咖啡花了20，打车花了30”），务必将其拆分为多条独立的记录返回。
  3. **金额识别**：优先寻找带有 "合计"、"实付"、"总计"、"Total" 字样附近的金额。
  4. **成员归属**：如果文本中明确提到了家庭成员（或从上下文可推断，如“儿子交学费”），请尝试将费用归属到对应成员。
  
  示例 1 (语音)：
  输入："买了一杯咖啡花了20，中午吃了一碗牛肉面花了30"
  输出：两个对象，咖啡(20元)，牛肉面(30元)。

  示例 2 (OCR 乱码)：
  输入："..LC本...合计 119.57 ... 2026-01-14 ..."
  输出：一个对象，金额 119.57，日期 2026-01-14。
  
  请返回以下 JSON 格式的数据（必须是一个包含“expenses”数组的对象，不要包含 Markdown 代码块，直接返回 JSON 字符串）：
  {
    "expenses": [
      {
        "project": "项目名称",
        "category": "分类名称(二级分类)",
        "sub_category": "子分类名称(三级分类)",
        "amount": 0.00,
        "expense_date": "YYYY-MM-DD",
        "description": "消费的具体内容描述(商户名/品名)",
        "member_name": "成员名称(如果能识别到)",
        "missing_info": [] // 如果缺少关键信息(如金额)，请在此列出
      }
    ]
  }
  `
  
  try {
    let rawContent = '{}'
    
    if (llmConfig.provider === 'deepseek') {
        const apiKey = llmConfig.apiKey.trim();
        console.log(`[LLM] Using DeepSeek with Key: ${apiKey.substring(0, 8)}...`);
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

    console.log(`[LLM] Response from ${llmConfig.provider}:`, rawContent)

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
    
    return { expenses: parsedExpenses, provider: llmConfig.provider }

  } catch (error: any) {
    console.error('Parsing error:', error)
    if (error.status === 402 || (error.message && error.message.includes('402'))) {
      throw new Error('API 余额不足，请检查对应服务商账户。')
    }
    throw new Error(`语义解析失败 (${llmConfig.provider}): ${error.message}`)
  }
}
