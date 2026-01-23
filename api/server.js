const app = require('./app')

const PORT = Number(process.env.PORT || 3001)

const deepseekConfigured = !!process.env.DEEPSEEK_API_KEY
console.log(`LLM provider: ${deepseekConfigured ? 'deepseek' : 'none'}`)

const server = app.listen(PORT, () => {
  console.log(`API server ready on port ${PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
