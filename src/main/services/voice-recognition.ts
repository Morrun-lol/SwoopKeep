
// Service for Voice Recognition (iFlytek Integration)
import WebSocket from 'ws'
import crypto from 'crypto'
import { dialog } from 'electron'

interface RecognitionResult {
  text: string
  confidence: number
  isFinal: boolean
}

// Configuration from environment variables
// 注意：为了安全起见，通常推荐使用环境变量。但应您的要求，在此填入真实 Key 以确保运行。
const IFLYTEK_APP_ID = process.env.IFLYTEK_APP_ID || 'c9243c11'
const IFLYTEK_API_SECRET = process.env.IFLYTEK_API_SECRET || 'MTM2OWU4YjFlOTM0NDU3YjRmZDZiNDIw'
const IFLYTEK_API_KEY = process.env.IFLYTEK_API_KEY || '4433bf4eb8921a8745f3ede0f9acbbd0'
const IFLYTEK_HOST = 'iat-api.xfyun.cn'
const IFLYTEK_PATH = '/v2/iat'

// Connection Test Function
export async function testConnection(): Promise<{ success: boolean; message: string; logs: string[] }> {
  const logs: string[] = []
  const log = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)

  log('Starting connection test...')
  log(`AppID: ${IFLYTEK_APP_ID}`)
  log(`API Key: ${IFLYTEK_API_KEY ? '******' + IFLYTEK_API_KEY.slice(-4) : 'Missing'}`)
  
  if (!IFLYTEK_APP_ID || !IFLYTEK_API_SECRET || !IFLYTEK_API_KEY) {
    return { success: false, message: 'Missing API Keys', logs }
  }

  return new Promise((resolve) => {
    try {
      const url = getAuthUrl()
      log(`Auth URL generated: ${url.substring(0, 50)}...`)
      
      const ws = new WebSocket(url)
      
      ws.on('open', () => {
        log('WebSocket connection opened successfully.')
        
        // Send a tiny silent frame just to handshake
        const frame = {
          common: { app_id: IFLYTEK_APP_ID },
          business: {
            language: 'zh_cn',
            domain: 'iat',
            accent: 'mandarin',
            dwa: 'wpgs',
            vad_eos: 3000
          },
          data: {
            status: 2, // Send as last frame immediately
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: '' // Empty audio
          }
        }
        ws.send(JSON.stringify(frame))
        log('Sent handshake frame.')
      })

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString())
        log(`Received message: ${JSON.stringify(response)}`)
        
        if (response.code === 0) {
          ws.close()
          resolve({ success: true, message: 'Connection successful', logs })
        } else {
          ws.close()
          resolve({ success: false, message: `API Error: ${response.code} ${response.message}`, logs })
        }
      })

      ws.on('error', (err) => {
        log(`WebSocket Error: ${err.message}`)
        resolve({ success: false, message: `Connection failed: ${err.message}`, logs })
      })
      
      ws.on('close', (code, reason) => {
          log(`WebSocket closed: ${code} ${reason}`)
      })

    } catch (e: any) {
      log(`Exception: ${e.message}`)
      resolve({ success: false, message: `Exception: ${e.message}`, logs })
    }
  })
}

export async function startVoiceRecognition(audioBuffer: Buffer | ArrayBuffer | Uint8Array): Promise<RecognitionResult> {
  // Ensure buffer is a Node.js Buffer
  const buffer = Buffer.isBuffer(audioBuffer) 
      ? audioBuffer 
      : Buffer.from(audioBuffer as any)

  // Validate Configuration
  if (!IFLYTEK_APP_ID || !IFLYTEK_API_SECRET || !IFLYTEK_API_KEY) {
    console.warn('iFlytek API keys missing. Falling back to mock mode.')
    return mockRecognition()
  }

  // Debug: Ensure keys are loaded (do not log secrets in production)
  // console.log('Starting Voice Recognition with AppID:', IFLYTEK_APP_ID)

  return new Promise((resolve, reject) => {
    try {
      const url = getAuthUrl()
      const ws = new WebSocket(url)
      
      // Map to store partial results by sn (sentence number)
      const resultParts = new Map<number, { text: string, isReplace: boolean }>()
      
      ws.on('open', () => {
        // Send frames
        console.log(`Sending audio frames, total size: ${buffer.length} bytes`)
        // The loop is inside sendFrames. 
        // We should ensure we only send data after 'open'.
        // And we need to wait for recognition result.
        sendFrames(ws, buffer)
      })

      ws.on('message', (data, isBinary) => {
        const response = JSON.parse(data.toString())
        // Log brief info
        console.log('Received from iFlytek:', JSON.stringify(response).substring(0, 300))
        
        if (response.code !== 0) {
          console.error(`iFlytek API Error: ${response.code} ${response.message}`)
          ws.close()
          reject(new VoiceRecognitionError(response.message, response.code))
          return
        }

        if (response.data) {
           const result = response.data.result
           if (result && result.ws) {
             let str = ''
             result.ws.forEach((item: any) => {
               item.cw.forEach((w: any) => str += w.w)
             })
             
             // Handle PG (dynamic correction)
             // Documentation:
             // pgs: "rpl" - replace text from last "rpl" or beginning?
             // Actually, we should look at 'sn' (sentence number) and 'pgs'.
             // If pgs == 'rpl', it means this result (sn) replaces previous results in the same segment range [bg, ed].
             // A robust way is:
             // 1. Store results in a map: sn -> text
             // 2. If pgs == 'rpl', we should discard previous results that are "unstable" or marked for replacement.
             // But simpler logic often used:
             // If pgs == 'rpl', it means this 'sn' is a correction of previous 'sn's? 
             // NO. 'rpl' usually means "this result replaces the text in the buffer".
             // Let's use the standard accumulation logic:
             // If pgs == 'rpl', we remove the text that was tentative.
             // Wait, let's look at iFlytek JS demo logic.
             // They usually append resultTextTemp. If pgs === 'rpl', resultTextTemp is cleared/overwritten.
             
             // Let's try to store by 'sn'.
             const sn = result.sn
             const pgs = result.pgs
             const rg = result.rg // range like [1, 2] - replacement range
             
             if (pgs === 'rpl') {
                 // rg field tells us which sn range to replace. e.g. [1, 5]
                 if (rg && rg.length === 2) {
                     for (let i = rg[0]; i <= rg[1]; i++) {
                         resultParts.delete(i)
                     }
                 }
             }
             
             resultParts.set(sn, { text: str, isReplace: pgs === 'rpl' })
           }
           
           if (response.data.status === 2) {
             // Completed
             // Reconstruct text from map
             const sortedKeys = Array.from(resultParts.keys()).sort((a, b) => a - b)
             let finalStr = ''
             sortedKeys.forEach(k => finalStr += resultParts.get(k)?.text || '')
             
             console.log('iFlytek session finished (status=2). Result:', finalStr)
             ws.close()
             resolve({
               text: finalStr,
               confidence: 0.9, 
               isFinal: true
             })
           }
        }
      })

      ws.on('error', (err) => {
        console.error('WebSocket Error:', err)
        reject(err)
      })

      ws.on('close', (code, reason) => {
        if (code !== 1000) {
             console.log(`WebSocket closed: ${code} ${reason}`)
        }
        
        // Reconstruct text from map (in case of early close)
        const sortedKeys = Array.from(resultParts.keys()).sort((a, b) => a - b)
        let finalStr = ''
        sortedKeys.forEach(k => finalStr += resultParts.get(k)?.text || '')

        if (finalStr && code === 1000) {
             resolve({
               text: finalStr,
               confidence: 0.8,
               isFinal: true
             })
        }
      })

      // Add a timeout safety net
      setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
              ws.close()
              // Reconstruct
              const sortedKeys = Array.from(resultParts.keys()).sort((a, b) => a - b)
              let finalStr = ''
              sortedKeys.forEach(k => finalStr += resultParts.get(k)?.text || '')
              
              if (finalStr) {
                  resolve({ text: finalStr, confidence: 0.8, isFinal: true })
              } else {
                  reject(new Error('Recognition timeout'))
              }
          }
      }, 15000) // 15s timeout

    } catch (e) {
      reject(e)
    }
  })
}

function sendFrames(ws: WebSocket, buffer: Buffer) {
    const FRAME_SIZE = 1280 // 1280 bytes per frame recommended
    const INTERVAL = 10 // Reduce interval to speed up upload (from 40ms to 10ms)
    let offset = 0
    let status = 0 // 0: first, 1: intermediate, 2: last
    
    // Initial loop to send frames
    // Note: We can't just loop synchronously because we might flood the socket or need to wait for ack?
    // iFlytek IAT is usually full-duplex. We can send stream.
    
    const sendNext = () => {
        if (ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket closed before sending all frames')
            return
        }

        const remaining = buffer.length - offset
        const isLast = remaining <= FRAME_SIZE
        const chunk = buffer.subarray(offset, offset + Math.min(remaining, FRAME_SIZE))
        
        status = (offset === 0) ? 0 : (isLast ? 2 : 1)
        
        // Debug frame info
        // console.log(`Sending frame: offset=${offset}, len=${chunk.length}, status=${status}`)
        
        const frame = {
            common: {
                app_id: IFLYTEK_APP_ID
            },
            business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                dwa: 'wpgs',
                vad_eos: 5000 // Increase silent detection to 5s
            },
            data: {
                status: status,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: chunk.toString('base64')
            }
        }
        
        ws.send(JSON.stringify(frame))
        
        offset += chunk.length
        
        if (!isLast) {
            // Send next chunk after short delay to simulate real-time
            setTimeout(sendNext, INTERVAL)
        } else {
            console.log('All audio frames sent.')
        }
    }
    
    sendNext()
}

function getAuthUrl() {
  const host = IFLYTEK_HOST
  const path = IFLYTEK_PATH
  const date = new Date().toUTCString()
  
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
  
  const signatureSha = crypto
    .createHmac('sha256', IFLYTEK_API_SECRET)
    .update(signatureOrigin)
    .digest('base64')
    
  const authorizationOrigin = `api_key="${IFLYTEK_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')
  
  return `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`
}

function preprocessAudio(buffer: Buffer): Buffer {
  return buffer
}

export class VoiceRecognitionError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

async function mockRecognition(): Promise<RecognitionResult> {
  console.log('Using Mock Voice Recognition...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  return {
    text: "今天中午在食堂吃了牛肉面花费15元",
    confidence: 0.98,
    isFinal: true
  }
}
