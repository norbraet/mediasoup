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

    const allHandlers = {
      // ...webrtcHandlers,
      ...roomHandlers,
    }

    Object.entries(allHandlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    socket.on('disconnect', async (reason) => {
      console.debug('Socket disconnected:', socket.id, 'reason:', reason)

      const leaveRoomHandler = allHandlers[SOCKET_EVENTS.LEAVE_ROOM]
      if (leaveRoomHandler) {
        await leaveRoomHandler()
      }
    })
  })

  return io
}
