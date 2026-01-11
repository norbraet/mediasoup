import { Server as SocketIOServer } from 'socket.io'
import { Server } from 'https'
import type { ClientService, RoomService } from '../types'
// import { createWebRTCHandlers } from './handlers/webrtcHandlers'
import env from '../config/env'
import { createRoomHandlers } from './handlers/roomHandlers'

export const initializeSocketIO = (
  httpsServer: Server,
  roomService: RoomService,
  clientService: ClientService
): SocketIOServer => {
  const io = new SocketIOServer(httpsServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connect', (socket) => {
    // TODO: I need to update the webrtcHandler
    // const webrtcHandlers = createWebRTCHandlers(socket, mediasoupService)
    const roomHandlers = createRoomHandlers(socket, roomService, clientService)

    // Combine all handlers
    const allHandlers = {
      // ...webrtcHandlers,
      ...roomHandlers,
    }

    // Register all handlers
    Object.entries(allHandlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })
  })

  return io
}
