import dotenv from 'dotenv';
dotenv.config();

import express from 'express'
import pinoHttp from 'pino-http'
import logger, { baseLogger } from './lib/logger'
import { recipeRouter } from './routes/recipes'
import { aiRouter } from './routes/ai'
import { miseRouter } from './routes/mise'
import { feedbackRouter } from './routes/feedback'
import savedRouter from './routes/saved'
import { sharesRouter } from './routes/shares'
import usersRouter from './routes/users'

const app = express()

app.use(pinoHttp({ logger: baseLogger }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.send('🟢 Backend is running')
})


app.use('/api/recipes', recipeRouter)
app.use('/api/ai', aiRouter)
app.use('/api/mise', miseRouter)
app.use('/api/feedback', feedbackRouter)
app.use('/api/saved', savedRouter)
app.use('/api/users', usersRouter)
app.use('/', sharesRouter)

// 👇 Only run this if executed directly (e.g., via `ts-node server/index.ts`)
if (require.main === module) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`🟢 Server running at http://localhost:${PORT}`)
  })
}

export default app