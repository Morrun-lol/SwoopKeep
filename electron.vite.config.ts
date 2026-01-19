import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(process.env.DEEPSEEK_API_KEY),
      'process.env.IFLYTEK_APP_ID': JSON.stringify(process.env.IFLYTEK_APP_ID),
      'process.env.IFLYTEK_API_SECRET': JSON.stringify(process.env.IFLYTEK_API_SECRET),
      'process.env.IFLYTEK_API_KEY': JSON.stringify(process.env.IFLYTEK_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY),
      'process.env.OPENAI_BASE_URL': JSON.stringify(process.env.OPENAI_BASE_URL),
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
})