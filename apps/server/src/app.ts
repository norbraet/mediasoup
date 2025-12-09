import express, { type Express } from 'express'
import cors from 'cors'
import env from './config/env'

export function createApp(): Express {
  const app = express()

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  )
  app.use(express.json())

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
    })
  })

  return app
}
