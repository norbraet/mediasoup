import { Server as SocketIOServer } from 'socket.io'
import { Server } from 'https'
import type { MediasoupService } from '../services/mediasoupService'
import { createWebRTCHandlers } from './handlers/webrtcHandlers'
import env from '../config/env'

export const initializeSocketIO = (
  httpsServer: Server,
  mediasoupService: MediasoupService
): SocketIOServer => {
  const io = new SocketIOServer(httpsServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connect', (socket) => {
    const handlers = createWebRTCHandlers(socket, mediasoupService)

    // Register Handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })
  })

  return io
}
