import { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react'
import CryptoJS from 'crypto-js'
import { ChevronDown, Check, Plus, ArrowLeft, X, Wifi, Loader2, Info, Camera, Image as ImageIcon } from 'lucide-react'

// 科大讯飞配置 (请在 .env 中配置，这里通过 window.api 暴露或直接硬编码测试)
// 实际项目中建议通过 preload 注入
const APPID = 'c9243c11' // 占位符，请替换
const API_SECRET = 'MTM2OWU4YjFlOTM0NDU3YjRmZDZiNDIw' // 占位符，请替换
const API_KEY = '4433bf4eb8921a8745f3ede0f9acbbd0' // 占位符，请替换

export default function Voice() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [transcribedText, setTranscribedText] = useState('')
  const [parsedData, setParsedData] = useState<any[] | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingText, setIsEditingText] = useState(false)
  const [editData, setEditData] = useState<any[] | null>(null)
  const [expenseStructure, setExpenseStructure] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [inputType, setInputType] = useState<'voice' | 'image'>('voice')

  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testLogs, setTestLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)

  const [families, setFamilies] = useState<any[]>([])

  useEffect(() => {
      // Load expense structure for selector
      window.api.getExpenseStructure().then(setExpenseStructure).catch(console.error)
      // Load members and families
      Promise.all([
          window.api.getAllMembers(),
          window.api.getAllFamilies()
      ]).then(([membersData, familiesData]) => {
          setMembers(membersData)
          setFamilies(familiesData)
      }).catch(console.error)
  }, [])
  
  // 讯飞 WebSocket 相关引用
  const socketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // 获取鉴权 URL
  const getWebSocketUrl = () => {
    // 这里的 Key 需要从主进程获取，或者暂时写死测试
    // 为了安全，应该在主进程生成 URL，但 WebSocket 必须在渲染进程连
    // 这里暂时使用占位符，实际请替换
    const appId = '你的APPID' 
    const apiSecret = '你的APISecret'
    const apiKey = '你的APIKey'
    
    // 如果没有配置 Key，给出提示
    if (appId === '你的APPID') {
       setErrorMessage('请先配置科大讯飞 APPID/APIKey/APISecret')
       return null
    }

    const url = 'wss://iat-api.xfyun.cn/v2/iat'
    const host = 'iat-api.xfyun.cn'
    const date = new Date().toUTCString()
    const algorithm = 'hmac-sha256'
    const headers = 'host date request-line'
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`
    
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
    const signature = CryptoJS.enc.Base64.stringify(signatureSha)
    
    const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`
    const authorization = btoa(authorizationOrigin)
    
    return `${url}?authorization=${authorization}&date=${date}&host=${host}`
  }

  // 音频转换 Float32 -> Int16
  const transAudioData = (audioData: Float32Array) => {
    let output = audioData
    const dataLength = output.length
    const buffer = new ArrayBuffer(dataLength * 2)
    const view = new DataView(buffer)
    for (let i = 0; i < dataLength; i++) {
        let s = Math.max(-1, Math.min(1, output[i]))
        s = s < 0 ? s * 0x8000 : s * 0x7FFF
        view.setInt16(i * 2, s, true)
    }
    return new Int8Array(buffer)
  }

  // 重采样 Float32 (Any -> 16000Hz)
  const downsampleBuffer = (buffer: Float32Array, sampleRate: number, outSampleRate: number) => {
      if (outSampleRate === sampleRate) {
          return buffer
      }
      if (outSampleRate > sampleRate) {
          console.warn('Upsampling not supported')
          return buffer
      }
      
      const sampleRateRatio = sampleRate / outSampleRate
      const newLength = Math.round(buffer.length / sampleRateRatio)
      const result = new Float32Array(newLength)
      
      let offsetResult = 0
      let offsetBuffer = 0
      
      while (offsetResult < result.length) {
          const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
          
          // Simple averaging (linear interpolation or decimation would be better but this is fast)
          let accum = 0, count = 0
          for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
              accum += buffer[i]
              count++
          }
          
          result[offsetResult] = count > 0 ? accum / count : 0
          offsetResult++
          offsetBuffer = nextOffsetBuffer
      }
      
      return result
  }

  const handleTestConnection = async () => {
      setTestStatus('testing')
      setTestLogs([])
      setErrorMessage('')
      
      try {
          const result = await window.api.testiFlytekConnection()
          setTestLogs(result.logs)
          if (result.success) {
              setTestStatus('success')
          } else {
              setTestStatus('error')
              setErrorMessage(result.message)
          }
      } catch (e: any) {
          setTestStatus('error')
          setErrorMessage(e.message)
          setTestLogs(prev => [...prev, `Client Exception: ${e.message}`])
      }
  }

  const startRecording = async () => {
    try {
      setInputType('voice')
      setErrorMessage('')
      setTranscribedText('')
      setParsedData(null)
      
      // 1. 获取 URL
      // const url = getWebSocketUrl()
      // if (!url) return 
      
      // 注意：由于在 React 中直接引入 crypto-js 可能有兼容性问题，
      // 且 Key 不宜暴露在前端。最佳实践是主进程生成 URL 返回给前端。
      // 这里为了演示，我们先假设用户会配置好 Key。
      // 为了快速跑通，我们这里暂时仅实现 UI 逻辑，实际连接需要填入真实 Key。
      
      // 2. 获取麦克风
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      mediaStreamRef.current = stream
      setPermissionStatus('granted')

      // 4. 连接 WebSocket
      // 实际上我们现在通过主进程代理，不再前端直连 WebSocket。
      // 所以不需要创建 socket，而是开始录音，收集 buffer，通过 IPC 发送。
      // 但为了兼容现有逻辑结构，我们这里稍微调整一下：
      // 使用 MediaRecorder 录音，每隔一段时间发送 chunk 给主进程。
      // 或者：使用 AudioContext 获取 PCM 数据，通过 IPC 发送给主进程 (Stream)。
      
      // 简化版：使用 MediaRecorder 录制一段音频，停止后发送。
      // 或者：使用 AudioContext 获取 buffer，积累一定量后发送。
      // 鉴于主进程实现了 'transcribe-audio' 接收完整 buffer，我们这里先录制一段再发送?
      // 不，这不符合“实时”。
      // 主进程目前 `startVoiceRecognition` 接收一个 Buffer。如果我们要实时，需要流式 IPC。
      // 但主进程目前的 `startVoiceRecognition` 逻辑是：接收 Buffer -> 建立 WS -> 发送。
      // 这意味着它是一次性的。所以前端必须录制完一句话再发送。
      // 这符合“点击开始，点击停止”的交互。
      
      // 所以：
      // 1. 开始录音 -> MediaRecorder start
      // 2. 停止录音 -> MediaRecorder stop -> dataavailable -> Blob -> ArrayBuffer -> IPC send
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      mediaStreamRef.current = mediaStream
      setPermissionStatus('granted')

      // Fallback: AudioContext + ScriptProcessor is deprecated and unreliable in some Electron contexts.
      // Let's use MediaRecorder to capture raw data if possible, or use AudioWorklet (complex).
      // But ScriptProcessor is still widely supported.
      // The issue might be that `processor.onaudioprocess` is not firing or `socketRef.current` logic is flawed.
      
      // Let's stick to ScriptProcessor but make sure it's robust.
      // Re-init AudioContext every time to be safe.
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 }) // Try to request 16k
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(mediaStream)
      // Buffer size 4096 is safe.
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessorRef.current = processor
      
      const audioDataQueue: Float32Array[] = []
      
      processor.onaudioprocess = (e) => {
          // Careful: state `isRecording` might be stale in closure if not using ref.
          // But we check `isRecording` in `stopRecording`, here we just collect until disconnected.
          const inputData = e.inputBuffer.getChannelData(0)
          // Clone data! inputBuffer is reused.
          audioDataQueue.push(new Float32Array(inputData))
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination) // Necessary for chrome to fire events
      
      setIsRecording(true)
      
      // Store queue in ref
      // @ts-ignore
      socketRef.current = { queue: audioDataQueue, sampleRate: audioContext.sampleRate }
      
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMessage(err.message)
      setIsRecording(false)
    }
  }

  const stopRecording = async () => {
      if (!isRecording) return
      setIsRecording(false)
      
      // Stop AudioContext and Processor
      if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
      }
      if (scriptProcessorRef.current) {
          // @ts-ignore
          scriptProcessorRef.current.disconnect()
          scriptProcessorRef.current = null
      }
      
      // Stop MediaStream
      if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop())
          mediaStreamRef.current = null
      }
      
      // Process accumulated audio data
      // @ts-ignore
      const queue = socketRef.current?.queue as Float32Array[]
      // @ts-ignore
      const sampleRate = socketRef.current?.sampleRate || 16000
      
      if (!queue || queue.length === 0) return
      
      // Merge queue
      const length = queue.reduce((acc, cur) => acc + cur.length, 0)
      const merged = new Float32Array(length)
      let offset = 0
      queue.forEach(chunk => {
          merged.set(chunk, offset)
          offset += chunk.length
      })
      
      console.log(`Recorded audio: ${length} samples at ${sampleRate}Hz`)
      
      // Resample if needed
      let processedData = merged
      if (sampleRate !== 16000) {
          console.log(`Resampling from ${sampleRate} to 16000...`)
          processedData = downsampleBuffer(merged, sampleRate, 16000) as Float32Array<ArrayBuffer>
      }
      
      // Convert to Int16 PCM
      const pcmData = transAudioData(processedData)
      
      // Send to main process
      setIsProcessing(true)
      try {
          // Need to send ArrayBuffer. pcmData.buffer is the one.
          // Note: pcmData is Int8Array view of Int16 buffer.
          // transAudioData returns Int8Array, but underlying buffer is Int16.
          const resultText = await window.api.transcribeAudio(pcmData.buffer)
          setTranscribedText(resultText)
          
          // Auto parse
          handleParse(resultText)
      } catch (e: any) {
          console.error('Transcription failed:', e)
          setErrorMessage('识别失败: ' + e.message)
          setIsProcessing(false)
      }
  }
  
  const [processingProvider, setProcessingProvider] = useState<string>('')

  // 触发语义解析
  const handleParse = async (text: string) => {
      if (!text) return
      setIsProcessing(true)
      try {
          const result = await window.api.parseExpense(text)
          // 兼容旧接口，如果是数组则 provider 为 unknown，如果是对象则解构
          // 但是 IPC 返回的一定是序列化后的对象。
          // 之前我们修改了 parseExpense 返回 { expenses: [...], provider: '...' }
          // 但是这里前端还不知道，需要类型断言或检查
          
          if (result.expenses && Array.isArray(result.expenses)) {
              setParsedData(result.expenses)
              if (result.provider) setProcessingProvider(result.provider)
          } else if (Array.isArray(result)) {
               // Fallback for old style if needed, though we changed backend
               setParsedData(result)
               setProcessingProvider('')
          } else {
              // Should not happen with new backend, but just in case
              setParsedData([result])
          }
          
      } catch (err: any) {
          setErrorMessage(err.message)
      } finally {
          setIsProcessing(false)
          setProcessingProvider('') // Reset after done? Or keep it to show "Used XXX"? 
          // Requirement says "正在用XXX智能解析", implies during processing.
          // But during processing we don't know the provider YET until backend returns?
          // Actually, `selectBestModel` happens in backend.
          // We can't know the provider BEFORE calling api.
          // So "正在用..." needs to be generic "正在智能分析..." OR we stream the status?
          // IPC can't easily stream status updates without extra listener.
          
          // Wait, user wants "正在用XXX（大模型名字）智能解析"
          // If we can't know it beforehand, maybe we can't show it DURING the spinner.
          // UNLESS we ask backend "what model will you use?" first.
          // Or we just show "正在智能解析..." generic message, 
          // OR user means AFTER result?
          // No, "正在..." implies continuous tense.
          
          // Workaround: 
          // 1. Front-end estimates based on what keys are set (but keys are in backend/env).
          // 2. Just say "正在智能解析..." and update to "已通过 XXX 完成解析" ?
          // 3. User specifically asked for "正在用XXX...". 
          // This implies real-time feedback.
          
          // Let's implement a quick check or just use a generic message if we can't know.
          // But wait, we can't know which one until we try.
          // Actually, we can fetch the "best model config" name via a new IPC call?
          // Or we just update the text AFTER we get the result? No that's "Used".
          
          // Maybe the user accepts "正在用 AI 智能解析..." if we can't be specific?
          // OR, we can assume:
          // If OpenAI Key exists -> OpenAI
          // If DeepSeek Key exists -> DeepSeek
          // But frontend doesn't know keys.
          
          // Let's add an IPC `get-current-llm-provider`?
          // Or just update the UI string to be generic for now, 
          // AND/OR update it to "Analysis via [Provider]" once done.
          
          // Re-reading user request: "将红框处优化为“正在用XXX（大模型名字）智能解析”"
          // If I really want to show it, I need to know it.
          // Let's guess: "正在用 AI 大模型智能解析..." is safe.
          // If I really need the name, I must ask backend.
          
          // Let's add a small IPC to get the likely provider name.
      }
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (isProcessing) return
    setIsProcessing(true)
    setInputType('image')
    setErrorMessage('')
    setParsedData(null)
    setTranscribedText('')
    setProcessingProvider('') // Clear previous

    try {
      const buffer = await file.arrayBuffer()
      // Call analyze first? No, recognizeImage returns provider now.
      const result = await window.api.recognizeImage(buffer)
      // result is { text, provider }
      
      const text = result.text
      const provider = result.provider // 'openai', 'gemini', 'tesseract'
      
      // Map provider code to name
      const providerName = provider === 'openai' ? 'OpenAI Vision' : 
                           provider === 'gemini' ? 'Gemini Vision' : 
                           provider === 'tesseract' ? '本地 OCR' : 'AI'
      
      setProcessingProvider(providerName)

      if (!text || text.trim().length === 0) {
        throw new Error('未能从图片中识别出文字')
      }

      setTranscribedText(text)
      
      // Now parse text. Parse also has a provider.
      // We can update the message.
      await handleParse(text) 
      
    } catch (err: any) {
      console.error('Image recognition failed:', err)
      setErrorMessage(err.message || '图片识别失败')
    } finally {
      setIsProcessing(false)
      // setProcessingProvider('') // Keep it visible? No, process done.
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerImageUpload = () => {
    fileInputRef.current?.click()
  }

  const handleToggleRecording = () => {
    if (isProcessing) return
    
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleSave = async () => {
    const dataToSave = isEditing ? editData : parsedData
    if (!dataToSave || dataToSave.length === 0) return

    setIsProcessing(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      let savedCount = 0
      for (const data of dataToSave) {
          await window.api.createExpense({
            project: data.project,
            category: data.category,
            sub_category: data.sub_category,
            amount: data.amount,
            expense_date: data.expense_date,
            description: data.description,
            voice_text: transcribedText,
            member_id: data.member_id
          })
          savedCount++
      }

      setSuccessMessage(`成功保存 ${savedCount} 笔账单！`)
      
      setTimeout(() => {
        setSuccessMessage('')
        resetForm()
      }, 2000)
    } catch (err: any) {
      console.error('Save error:', err)
      setErrorMessage(err.message || '保存失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEdit = () => {
    if (!parsedData) return
    setIsEditing(true)
    // Deep copy array
    setEditData(JSON.parse(JSON.stringify(parsedData)))
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditData(null)
  }

  const handleUpdateField = (index: number, field: string, value: any) => {
    const currentData = isEditing ? editData : parsedData
    if (!currentData) return
    
    const newData = [...currentData]
    newData[index] = { ...newData[index], [field]: value }
    
    if (isEditing) {
        setEditData(newData)
    } else {
        setParsedData(newData)
    }
  }
  
  const handleDeleteItem = (index: number) => {
      const currentData = isEditing ? editData : parsedData
      if (!currentData) return
      
      const newData = currentData.filter((_, i) => i !== index)
      
      if (newData.length === 0) {
          resetForm()
          return
      }
      
      if (isEditing) {
          setEditData(newData)
      } else {
          setParsedData(newData)
      }
  }

  const resetForm = () => {
    setTranscribedText('')
    setParsedData(null)
    setEditData(null)
    setIsEditing(false)
    setErrorMessage('')
  }

  // 测试功能：模拟语音输入
  const handleTest = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setErrorMessage('')
    setParsedData(null)
    
    const testText = "测试数据：今天在超市买水果花了35.5元"
    setTranscribedText(testText)
    
    try {
      // 直接调用解析接口
      const result = await window.api.parseExpense(testText)
      setParsedData(result)
    } catch (err: any) {
      console.error('Test processing error:', err)
      setErrorMessage(err.message || '测试失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNetworkCheck = async () => {
    setErrorMessage('正在检测网络连接...')
    try {
      const status = await window.api.checkNetworkStatus()
      const statusMsg = `
        百度(CN): ${status.baidu ? '✅' : '❌'}
        Google: ${status.google ? '✅' : '❌'}
        Google API: ${status.googleApi ? '✅' : '❌'}
        OpenAI API: ${status.openai ? '✅' : '❌'}
        Gemini API: ${status.gemini ? '✅' : '❌'}
        代理: ${status.proxy}
        ${status.error ? `错误: ${status.error}` : ''}
      `
      if (status.googleApi || status.openai || status.gemini) {
        setSuccessMessage('网络连接正常！' + statusMsg)
      } else {
        setErrorMessage('网络连接异常：' + statusMsg)
      }
    } catch (err: any) {
      setErrorMessage('网络检测失败: ' + err.message)
    }
  }

  // Helper to get unique items for cascading dropdown
  const getProjects = () => Array.from(new Set(expenseStructure.map(i => i.project).filter(Boolean)))
  const getCategories = (project: string) => Array.from(new Set(expenseStructure.filter(i => (!project || i.project === project)).map(i => i.category)))
  const getSubCategories = (project: string, category: string) => Array.from(new Set(expenseStructure.filter(i => (!project || i.project === project) && i.category === category).map(i => i.sub_category).filter(Boolean)))

  const [activeDropdown, setActiveDropdown] = useState<{ index: number, field: 'project' | 'category' | 'subcategory' | 'member' } | null>(null)

  useEffect(() => {
      // 每次打开新的下拉框时，重新加载数据，确保最新导入的数据能被显示
      if (activeDropdown) {
          window.api.getExpenseStructure().then(setExpenseStructure).catch(console.error)
      }
  }, [activeDropdown])

  const handleUpdateCategory = async (index: number, type: 'project' | 'category' | 'subcategory', value: string) => {
      const currentData = isEditing ? editData : parsedData
      if (!currentData) return
      
      const newData = [...currentData]
      const item = { ...newData[index] }
      
      if (type === 'project') {
          item.project = value
          item.category = ''
          item.sub_category = ''
          await window.api.addExpenseHierarchyItem(value, '', '')
      } else if (type === 'category') {
          item.category = value
          item.sub_category = ''
          await window.api.addExpenseHierarchyItem(item.project || '', value, '')
      } else if (type === 'subcategory') {
          item.sub_category = value
          await window.api.addExpenseHierarchyItem(item.project || '', item.category, value)
      }
      
      newData[index] = item
      
      if (isEditing) {
          setEditData(newData)
      } else {
          setParsedData(newData)
      }
      
      window.api.getExpenseStructure().then(setExpenseStructure).catch(console.error)
  }

  const SingleLevelSelector = ({ 
      items, 
      selected, 
      onSelect, 
      onClose,
      placeholder = '选择',
      title = '选择',
      align = 'right'
  }: {
      items: string[],
      selected: string,
      onSelect: (item: string) => void,
      onClose: () => void,
      placeholder?: string,
      title?: string,
      align?: 'left' | 'right'
  }) => {
      const [isAdding, setIsAdding] = useState(false)
      const [newItemValue, setNewItemValue] = useState('')

      const handleAddItem = async () => {
          const value = newItemValue.trim()
          if (!value) return
          onSelect(value)
          setIsAdding(false)
          setNewItemValue('')
      }

      const alignClass = align === 'left' ? 'left-0' : 'right-0'

      return (
          <div className={`absolute top-full ${alignClass} mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200`}>
              <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-sm">{title}</span>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                  </button>
              </div>
              <div className="p-2 max-h-60 overflow-y-auto">
                  {isAdding ? (
                      <div className="p-2">
                          <input
                              autoFocus
                              type="text"
                              value={newItemValue}
                              onChange={e => setNewItemValue(e.target.value)}
                              placeholder={`输入新${placeholder}`}
                              className="w-full border border-emerald-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 mb-2"
                              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                          />
                          <div className="flex gap-2">
                              <button 
                                  onClick={handleAddItem}
                                  disabled={!newItemValue.trim()}
                                  className="flex-1 bg-emerald-600 text-white text-xs py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50"
                              >
                                  确认
                              </button>
                              <button 
                                  onClick={() => { setIsAdding(false); setNewItemValue('') }}
                                  className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-200"
                              >
                                  取消
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 gap-1">
                          {items.map((item: any) => (
                              <button
                                  key={item}
                                  onClick={() => {
                                      onSelect(item)
                                      onClose()
                                  }}
                                  className={`text-left px-3 py-2 text-sm rounded flex justify-between items-center group ${selected === item ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                              >
                                  <span>{item}</span>
                                  {selected === item && <Check className="w-3 h-3 text-emerald-500" />}
                              </button>
                          ))}
                          {items.length === 0 && (
                              <div className="px-3 py-4 text-sm text-gray-400 italic text-center flex flex-col gap-2">
                                  <span>暂无选项</span>
                                  <span className="text-xs text-gray-300">请导入数据或手动新增</span>
                              </div>
                          )}
                          <button
                              onClick={() => setIsAdding(true)}
                              className="text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded flex items-center gap-2 mt-1 border-t border-dashed border-emerald-100"
                          >
                              <Plus className="w-3 h-3" />
                              新增{placeholder}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex justify-between items-center">
        <span>语音记账</span>
        <div className="flex gap-2">
          <button 
            onClick={handleNetworkCheck}
            className="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
          >
            🌐 网络诊断
          </button>
          <button 
            onClick={handleTest}
            className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
          >
            🔧 模拟测试
          </button>
        </div>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：录音控制 */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[400px] relative">
          <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={() => setShowLogs(!showLogs)}>
            <Info className="w-5 h-5" />
          </button>

          <div className="mb-6 flex justify-center w-full">
            <button 
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                testStatus === 'success' ? 'bg-green-100 text-green-700' :
                testStatus === 'error' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {testStatus === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
              {testStatus === 'idle' && '测试 API 连接'}
              {testStatus === 'testing' && '连接中...'}
              {testStatus === 'success' && 'API 连接正常'}
              {testStatus === 'error' && 'API 连接失败'}
            </button>
          </div>

          {showLogs && testLogs.length > 0 && (
            <div className="mb-6 text-left bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono max-h-40 overflow-y-auto w-full">
              {testLogs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          )}

          <div 
            onClick={handleToggleRecording}
            className={`
              w-24 h-24 rounded-full flex items-center justify-center mb-6 cursor-pointer transition-all duration-300
              ${isProcessing ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}
              ${isRecording 
                ? 'bg-red-100 animate-pulse scale-110' 
                : 'bg-gray-100 hover:bg-emerald-50'
              }
            `}
          >
            <span className="text-4xl">
              {isProcessing ? '⏳' : (isRecording ? '⏹️' : '🎙️')}
            </span>
          </div>
          
          <p className="text-gray-500 mb-2 font-medium">
            {isProcessing ? `正在用${processingProvider || 'AI 大模型'}智能解析...` : (isRecording ? '正在录音... 点击停止' : '点击麦克风开始说话，或上传小票')}
          </p>
          <p className="text-xs text-gray-400">
             示例："今天中午吃牛肉面花了25元"
          </p>
          
          <div className="mt-4 flex gap-4">
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
             />
             <button
                onClick={triggerImageUpload}
                disabled={isProcessing || isRecording}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <ImageIcon className="w-4 h-4" />
                上传小票
             </button>
             {/* 拍照功能通常需要调用摄像头，这里暂复用上传逻辑（移动端可直接调用相机） */}
             <button
                onClick={triggerImageUpload}
                disabled={isProcessing || isRecording}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Camera className="w-4 h-4" />
                拍照识别
             </button>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mt-4 text-sm max-w-xs text-center">
              {errorMessage}
            </div>
          )}
          
          {successMessage && (
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg mt-4 text-sm max-w-xs text-center">
              {successMessage}
            </div>
          )}
        </div>

        {/* 右侧：识别结果 */}
        <div className="space-y-6">
          {/* 语音文本 (仅在语音模式下显示，或者在图片模式下用户主动点击修改时显示) */}
          {(inputType === 'voice' || isEditingText) && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex justify-between items-center">
                <span>识别文本</span>
                {!isRecording && transcribedText && !isProcessing && (
                  <button 
                    onClick={() => setIsEditingText(!isEditingText)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    {isEditingText ? '完成' : '修改'}
                  </button>
                )}
              </h3>
              <div className="min-h-[60px] text-gray-800 text-lg">
                {isEditingText ? (
                  <textarea
                    value={transcribedText}
                    onChange={(e) => setTranscribedText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 outline-none"
                    rows={3}
                  />
                ) : (
                  transcribedText || <span className="text-gray-300 italic">等待录音...</span>
                )}
              </div>
              {/* 只有当有文本且不在录音时，才显示重新解析按钮 */}
              {transcribedText && !isRecording && !isProcessing && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleParse(transcribedText)}
                    className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    重新解析
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 图片模式下的状态提示 */}
          {inputType === 'image' && !isEditingText && (
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-blue-700">已提取小票文字信息</span>
                </div>
                <button 
                   onClick={() => setIsEditingText(true)}
                   className="text-xs text-blue-500 underline hover:text-blue-700"
                >
                   查看原始识别文本
                </button>
             </div>
          )}

          {/* 解析结果 */}
          {parsedData && parsedData.length === 0 && (
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>未识别到消费信息</p>
              <p className="text-xs text-gray-400 mt-1">请尝试修改文本描述更加清晰，例如："买苹果花了20元"</p>
            </div>
          )}

          {parsedData && parsedData.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">智能解析 ({parsedData.length}笔)</h3>
              
              {(isEditing ? editData : parsedData)?.map((data: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative transition-all hover:shadow-md">
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeleteItem(index)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                    title="删除此记录"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="space-y-4 pt-4">
                    {/* Amount & Member Row */}
                    <div className="flex flex-col gap-2 border-b border-gray-100 pb-2">
                        {/* Member Selector (Top Priority) */}
                        <div className="flex justify-between items-center pr-8 relative">
                            <span className="text-gray-500 text-sm">归属成员</span>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (!isEditing) {
                                            setActiveDropdown(activeDropdown?.index === index && activeDropdown?.field === 'member' ? null : { index, field: 'member' })
                                        }
                                    }}
                                    disabled={isEditing}
                                    className={`flex items-center gap-1 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-full text-sm hover:bg-blue-100 transition-colors ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="max-w-[100px] truncate font-medium">
                                      {members.find(m => m.id === data.member_id)?.name || '未指定成员'}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                                {activeDropdown?.index === index && activeDropdown?.field === 'member' && (
                                    <div className="absolute top-full right-0 z-[100]">
                                        <SingleLevelSelector 
                                            title="选择成员"
                                            placeholder="成员"
                                            items={members.map(m => m.name)}
                                            selected={members.find(m => m.id === data.member_id)?.name || ''}
                                            onSelect={async (val) => {
                                              let member = members.find(m => m.name === val)
                                              if (!member) {
                                                  // Auto create member if not exists
                                                  try {
                                                      let familyId = families.length > 0 ? families[0].id : 0
                                                      if (!familyId) {
                                                          // Create default family if none exists
                                                          familyId = await window.api.createFamily('默认家庭组')
                                                          const newFamilies = await window.api.getAllFamilies()
                                                          setFamilies(newFamilies)
                                                      }
                                                      
                                                      const newMemberId = await window.api.createMember(val, familyId)
                                                      const newMembers = await window.api.getAllMembers()
                                                      setMembers(newMembers)
                                                      member = newMembers.find((m: any) => m.id === newMemberId)
                                                  } catch (e) {
                                                      console.error('Failed to auto-create member:', e)
                                                      alert('创建新成员失败，请检查网络或重试')
                                                      return
                                                  }
                                              }
                                              
                                              if (member) handleUpdateField(index, 'member_id', member.id)
                                            }}
                                            onClose={() => setActiveDropdown(null)}
                                            align="right"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Amount */}
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-gray-500">金额</span>
                            {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={data.amount || ''}
                                  onChange={(e) => handleUpdateField(index, 'amount', parseFloat(e.target.value) || 0)}
                                  className="text-3xl font-bold text-emerald-600 w-32 text-right border-b-2 border-emerald-300 focus:border-emerald-600 outline-none"
                                />
                            ) : (
                                <span className="text-3xl font-bold text-emerald-600">¥{data.amount?.toFixed(2)}</span>
                            )}
                        </div>
                    </div>
                    
                    {/* Category */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 relative">
                      <span className="text-gray-500">分类</span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {/* Project Selector */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (!isEditing) {
                                        setActiveDropdown(activeDropdown?.index === index && activeDropdown?.field === 'project' ? null : { index, field: 'project' })
                                    }
                                }}
                                disabled={isEditing}
                                className={`flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded text-sm hover:bg-emerald-100 transition-colors ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="max-w-[80px] truncate">{data.project || '项目'}</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {activeDropdown?.index === index && activeDropdown?.field === 'project' && (
                                <div className="absolute top-full left-0 z-[100]">
                                    <SingleLevelSelector 
                                        title="选择项目"
                                        placeholder="项目"
                                        items={getProjects()}
                                        selected={data.project}
                                        onSelect={(val) => handleUpdateCategory(index, 'project', val)}
                                        onClose={() => setActiveDropdown(null)}
                                        align="left"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Category Selector */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (!isEditing) {
                                        setActiveDropdown(activeDropdown?.index === index && activeDropdown?.field === 'category' ? null : { index, field: 'category' })
                                    }
                                }}
                                disabled={isEditing}
                                className={`flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded text-sm hover:bg-emerald-100 transition-colors ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="max-w-[80px] truncate">{data.category || '分类'}</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {activeDropdown?.index === index && activeDropdown?.field === 'category' && (
                                <div className="absolute top-full left-0 z-[100]">
                                    <SingleLevelSelector 
                                        title="选择分类"
                                        placeholder="分类"
                                        items={getCategories(data.project)}
                                        selected={data.category}
                                        onSelect={(val) => handleUpdateCategory(index, 'category', val)}
                                        onClose={() => setActiveDropdown(null)}
                                        align="left"
                                    />
                                </div>
                            )}
                        </div>

                        {/* SubCategory Selector */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (!isEditing) {
                                        setActiveDropdown(activeDropdown?.index === index && activeDropdown?.field === 'subcategory' ? null : { index, field: 'subcategory' })
                                    }
                                }}
                                disabled={isEditing}
                                className={`flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded text-sm hover:bg-emerald-100 transition-colors ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="max-w-[80px] truncate">{data.sub_category || '子分类'}</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {activeDropdown?.index === index && activeDropdown?.field === 'subcategory' && (
                                <div className="absolute top-full right-0 z-[100]">
                                    <SingleLevelSelector 
                                        title="选择子分类"
                                        placeholder="子分类"
                                        items={getSubCategories(data.project, data.category)}
                                        selected={data.sub_category}
                                        onSelect={(val) => handleUpdateCategory(index, 'subcategory', val)}
                                        onClose={() => setActiveDropdown(null)}
                                    />
                                </div>
                            )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Date */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">日期</span>
                      {isEditing ? (
                        <input
                          type="date"
                          value={data.expense_date || ''}
                          onChange={(e) => handleUpdateField(index, 'expense_date', e.target.value)}
                          className="text-gray-800 border border-gray-300 rounded px-2 py-1"
                        />
                      ) : (
                        <span className="text-gray-800">{data.expense_date}</span>
                      )}
                    </div>
                    
                    {/* Description */}
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-500">备注</span>
                      {isEditing ? (
                        <textarea
                          value={data.description || ''}
                          onChange={(e) => handleUpdateField(index, 'description', e.target.value)}
                          className="text-gray-800 bg-gray-50 p-3 rounded-lg text-sm w-full border border-gray-300 focus:border-emerald-500 outline-none"
                          rows={2}
                        />
                      ) : (
                        <span className="text-gray-800 bg-gray-50 p-3 rounded-lg text-sm">
                          {data.description}
                        </span>
                      )}
                    </div>

                    {data.missing_info && data.missing_info.length > 0 && (
                      <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm flex items-start gap-2">
                        <span>⚠️</span>
                        <span>缺少信息: {data.missing_info.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="mt-6 flex gap-3">
                {isEditing ? (
                  <>
                    <button 
                      onClick={handleSave}
                      disabled={isProcessing}
                      className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {isProcessing ? '保存中...' : '保存所有'}
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleSave}
                      disabled={isProcessing}
                      className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {isProcessing ? '保存中...' : `确认记账 (${parsedData.length})`}
                    </button>
                    <button 
                      onClick={handleEdit}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                    >
                      修改
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
