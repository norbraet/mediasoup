import { createServer } from 'http'
import { createApp } from './app'
import env from './config/env'

async function main() {
  const app = createApp()
  const httpServer = createServer(app).listen(env.EXPRESS_PORT)

  console.log('Server is running on port:', env.EXPRESS_PORT)
}

try {
  main()
} catch (error) {
  console.error('Fatal server error:', error)
}
