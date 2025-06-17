import express from 'express'
import pinoHttp from 'pino-http'
import logger from './lib/logger'
import { recipeRouter } from './routes/recipes'
import { ingredientRouter } from './routes/ingredients'

const app = express()

app.use(pinoHttp({ logger }))

app.use(express.json())

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.send('🟢 Backend is running')
})

app.use('/api/recipes', recipeRouter)
app.use('/api/ingredients', ingredientRouter)

export default app
