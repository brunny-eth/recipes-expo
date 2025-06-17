import express from 'express'
import pinoHttp from 'pino-http'
import logger from './lib/logger'
import { recipeRouter } from './routes/recipes'

const app = express()

app.use(pinoHttp({ logger }))

app.use(express.json())

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.send('🟢 Backend is running')
})

app.use('/api/recipes', recipeRouter)

export default app
