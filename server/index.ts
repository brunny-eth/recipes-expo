import dotenv from 'dotenv';
dotenv.config();

import express from 'express'
import pinoHttp from 'pino-http'
import logger from './lib/logger'
import { recipeRouter } from './routes/recipes'
import { aiRouter } from './routes/ai'

const app = express()

app.use(pinoHttp({ logger }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.send('🟢 Backend is running')
})

app.use('/api/recipes', recipeRouter)
app.use('/api/ai', aiRouter)

// 👇 Only run this if executed directly (e.g., via `ts-node server/index.ts`)
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`🟢 Server running at http://localhost:${PORT}`)
  })
}

export default app