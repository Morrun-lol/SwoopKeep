/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import fs from 'fs'
import authRoutes from './routes/auth.js'
import aiRoutes from './routes/ai.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnv(): void {
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
  Object.entries(parsed).forEach(([key, value]) => {
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
  })

  process.env.__ENV_LOADED_FROM = envPath
}

// load env (supports UTF-8 / UTF-16LE saved by Windows editors)
loadEnv()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
