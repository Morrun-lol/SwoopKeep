const app = require('./app')

const PORT = Number(process.env.PORT || 3001)

const provider = process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.OPENAI_API_KEY ? 'openai' : 'none'
console.log(`LLM provider: ${provider}`)

const server = app.listen(PORT, () => {
  console.log(`API server ready on port ${PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
