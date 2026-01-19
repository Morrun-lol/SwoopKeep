import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const ENV_PATH = path.join(process.cwd(), '.env')

export function getEnvConfig() {
  // Read from process.env or file?
  // Reading from file is better to show what's persisted.
  // But process.env might have overrides.
  // Let's read from file to ensure we edit what is there.
  
  let envContent = ''
  try {
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8')
    }
  } catch (e) {
    console.error('Failed to read .env', e)
  }

  // Parse manually or use dotenv.parse? 
  // We want to preserve comments if possible, but dotenv doesn't stringify with comments easily.
  // Simple regex matching for specific keys is safer to preserve other structure.
  
  const getVal = (key: string) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match ? match[1].trim() : ''
  }

  return {
    httpsProxy: getVal('HTTPS_PROXY') || getVal('HTTP_PROXY') || '',
    openAiKey: getVal('OPENAI_API_KEY') || '',
    openAiBaseUrl: getVal('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
    geminiKey: getVal('GEMINI_API_KEY') || ''
  }
}

export function saveEnvConfig(config: { httpsProxy: string; openAiKey: string; openAiBaseUrl: string; geminiKey: string }) {
  let envContent = ''
  try {
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8')
    }
  } catch (e) {
    console.error('Failed to read .env', e)
  }

  const updateOrAdd = (key: string, value: string) => {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
    // Update memory immediately
    process.env[key] = value
  }

  if (config.httpsProxy) {
      updateOrAdd('HTTPS_PROXY', config.httpsProxy)
      updateOrAdd('HTTP_PROXY', config.httpsProxy) // Set both
  } else {
      // If empty, remove or set empty? Set empty.
      // Or maybe user wants to delete it.
      // For now, let's just set it.
      // If user clears it, we might want to remove it.
      // Let's keep it simple: set to value (even if empty string)
      updateOrAdd('HTTPS_PROXY', config.httpsProxy)
      updateOrAdd('HTTP_PROXY', config.httpsProxy)
  }
  
  updateOrAdd('OPENAI_API_KEY', config.openAiKey)
  updateOrAdd('OPENAI_BASE_URL', config.openAiBaseUrl)
  updateOrAdd('GEMINI_API_KEY', config.geminiKey)

  // Clean up multiple newlines
  envContent = envContent.replace(/\n{3,}/g, '\n\n').trim()

  fs.writeFileSync(ENV_PATH, envContent, 'utf-8')
  return true
}
