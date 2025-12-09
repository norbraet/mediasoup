import fs from 'fs'
import { createServer } from 'https'
import { createApp } from './express/app'
import { initMediasoup } from './mediasoup/createMediasoup'
import env from './config/env'
import { Server as SocketIOServer } from 'socket.io'

async function main(): Promise<void> {
  const app = createApp()

  // Keys were made with mkcert
  const key = fs.readFileSync('./config/create-cert-key.pem')
  const cert = fs.readFileSync('./config/create-cert.pem')
  const options = {
    key: key,
    cert: cert,
  }

  const httpsServer = createServer(options, app).listen(env.EXPRESS_PORT)
  new SocketIOServer(httpsServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  console.log('Server is running on port:', env.EXPRESS_PORT)

  initMediasoup()
}

try {
  main()
} catch (error) {
  console.error('Fatal server error:', error)
}
