import { Server as SocketIOServer } from 'socket.io'
import { Server } from 'https'
import type { ClientService, RoomService } from '../types'
// import { createWebRTCHandlers } from './handlers/webrtcHandlers'
import env from '../config/env'
import { createRoomHandlers } from './handlers/roomHandlers'
import { SOCKET_EVENTS } from '@mediasoup/types'

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
    console.debug('New socket connection:', socket.id)

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

    // Handle disconnect - clean up client resources
    socket.on('disconnect', async (reason) => {
      console.debug('Socket disconnected:', socket.id, 'reason:', reason)

      // Use the same cleanup logic as leave-room
      const leaveRoomHandler = allHandlers[SOCKET_EVENTS.LEAVE_ROOM]
      if (leaveRoomHandler) {
        await leaveRoomHandler()
      }
    })
  })

  return io
}
