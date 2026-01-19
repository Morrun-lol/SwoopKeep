import { createWorker } from 'tesseract.js';
import { Jimp } from 'jimp';
import { app } from 'electron';
import path from 'path';
import OpenAI from 'openai';
import { selectBestModel } from './llm';
import { ProxyAgent, fetch } from 'undici';

export async function recognizeReceipt(imageBuffer: Buffer): Promise<{text: string, provider: string}> {
  // 1. 优先尝试使用 Vision LLM (根据 selectBestModel 策略)
  try {
      const llmConfig = await selectBestModel('ocr');
      
      if (llmConfig.provider === 'openai') {
          console.log('Using OpenAI Vision for OCR...');
          const openai = new OpenAI({ 
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            // @ts-ignore
            httpAgent: (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) ? new ProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY) : undefined
          });
          
          const base64Image = imageBuffer.toString('base64');
          
          const response = await openai.chat.completions.create({
              model: llmConfig.model || "gpt-4o",
              messages: [
                  {
                      role: "user",
                      content: [
                          { type: "text", text: "Please transcribe all text from this receipt image accurately. Output only the raw text content, no markdown formatting." },
                          {
                              type: "image_url",
                              image_url: {
                                  "url": `data:image/jpeg;base64,${base64Image}`
                              }
                          }
                      ]
                  }
              ],
              max_tokens: 1000
          });
          
          return { text: response.choices[0].message.content || "", provider: 'openai' };
      } else if (llmConfig.provider === 'gemini') {
          console.log('Using Gemini Vision for OCR...');
          const base64Image = imageBuffer.toString('base64');
          
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model || 'gemini-1.5-flash'}:generateContent?key=${llmConfig.apiKey}`
          
          const body = {
              contents: [{
                  parts: [
                      { text: "Please transcribe all text from this receipt image accurately. Output only the raw text content, no markdown formatting." },
                      {
                          inline_data: {
                              mime_type: "image/jpeg",
                              data: base64Image
                          }
                      }
                  ]
              }]
          }
          
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
          
          if (!res.ok) throw new Error(`Gemini Vision Error: ${res.statusText}`)
          
          const data: any = await res.json()
          return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "", provider: 'gemini' };
      }
      
      console.log('No Vision LLM selected or configured, falling back to Tesseract...');
  } catch (e) {
      console.error('Vision API failed, falling back to Tesseract:', e);
  }

  try {
    console.log('Starting Local OCR process (Tesseract)...');
    
    // 1. Image Preprocessing
    console.log('Preprocessing image...');
    const image = await Jimp.read(imageBuffer);
    
    // Resize if too small (width < 1000px)
    if (image.width < 1000) {
      image.resize({ w: 1000 }); // Scale up width to 1000px, auto height
    }
    
    image
      .greyscale()
      .contrast(0.5) // Increase contrast significantly
      .normalize();  // Normalize brightness
      
    const processedBuffer = await image.getBuffer('image/png');
    
    // 2. OCR with Tesseract
    console.log('Initializing Tesseract...');
    
    // Ensure we have a writable cache path
    const cachePath = path.join(app.getPath('userData'), 'tessdata');
    console.log(`Using Tesseract cache path: ${cachePath}`);

    // 禁用自动下载，强制使用本地缓存
    // 并且显式指定 gzip: false 以防止 gzip 解压问题（如果手动下载了非 gzip 文件）
    // 或者我们直接回退到官方 CDN，因为用户网络似乎连 gitmirror 都连不上
    const worker = await createWorker('eng', 1, {
      langPath: 'https://tessdata.projectnaptha.com/4.0.0', 
      cachePath: cachePath,
      logger: m => console.log(m)
    });
    
    // PSM 6: Assume a single uniform block of text. Good for receipts.
    // PSM 4: Assume a single column of text of variable sizes.
    // PSM 3: Fully automatic page segmentation, but no OSD. (Default)
    // Let's try default first with better image, or PSM 6 if layout is simple.
    // Receipts often have complex layout (columns). Default (3) might be better, or 6.
    // Let's stick to default for now but use the processed image.
    
    const ret = await worker.recognize(processedBuffer, {
        rotateAuto: true, // Auto rotate
    });
    
    console.log('OCR Confidence:', ret.data.confidence);
    console.log('OCR Text Preview:', ret.data.text.substring(0, 100).replace(/\n/g, ' '));
    
    const text = ret.data.text;
    
    await worker.terminate();
    return { text, provider: 'tesseract' };
  } catch (error: any) {
    console.error('OCR Error:', error);
    throw new Error(`图片识别失败: ${error.message}`);
  }
}
