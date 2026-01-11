import fs from 'fs'
import { createServer } from 'https'
import { createApp } from './express/app'
import env from './config/env'
import { initializeSocketIO } from './socketio/socketManager'
import { createRoomService } from './services/roomService'
import { createClientService } from './services/clientService'
import { createWorkerPoolService } from './services/workerPoolService'

async function main(): Promise<void> {
  const app = createApp()

  // Keys were made with mkcert
  const key = fs.readFileSync('./create-cert-key.pem')
  const cert = fs.readFileSync('./create-cert.pem')
  const options = {
    key: key,
    cert: cert,
  }

  const httpsServer = createServer(options, app)
  httpsServer.listen(env.EXPRESS_PORT, () => {
    const link = (url: string): string => `\x1b[36m${url}\x1b[0m`

    console.debug('🚀 Conference Server Started!')
    console.debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.debug('🔌 Server port:', env.EXPRESS_PORT)
    console.debug(`📡 Server URL:   ${link(env.SERVER_URL)}`)
    console.debug(`🌐 Network Access:`)
    env.ALL_IPS.forEach((ip) => {
      if (ip !== 'localhost' && ip !== '127.0.0.1') {
        console.debug(`                 ${link(`https://${ip}:${env.EXPRESS_PORT}`)}`)
      }
    })
    console.debug(`💻 Local Access: ${link(`https://localhost:${env.EXPRESS_PORT}`)}`)
  })

  // const mediasoupService = await createMediasoupService()
  const workerPool = await createWorkerPoolService()
  const roomService = createRoomService(workerPool)
  const clientService = createClientService()

  initializeSocketIO(httpsServer, roomService, clientService)
}

try {
  main()
} catch (error) {
  console.error('Fatal server error:', error)
}
