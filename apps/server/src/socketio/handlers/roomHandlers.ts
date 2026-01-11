import { Socket } from 'socket.io'
import { ClientService, JoinRoomAck, RoomHandlers, RoomService } from '../../types'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  return {
    'join-room': handleJoinRoom(socket, roomService, clientService),
  }
}

const handleJoinRoom =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (
    data: { userName: string; roomName: string },
    acknowledgement: JoinRoomAck
  ): Promise<void> => {
    try {
      console.group('Join Room Request')
      console.debug('User:', data.userName)
      console.debug('Room:', data.roomName)
      console.debug('Socket ID:', socket.id)

      const { userName, roomName } = data

      const client = clientService.createClient(socket, userName)

      // Get or create room (room has the router)
      let room = roomService.getRoomByName(roomName)
      if (!room) {
        console.debug('Creating new room:', roomName)
        room = await roomService.createRoom(roomName)
      } else {
        console.debug('Found existing room:', roomName)
      }

      // Add client to room
      room.addClient(client)
      socket.join(roomName)

      // Get current producers in the room
      const currentProducers = room.getProducers()

      console.debug('Successfully joined room')
      console.debug('Router capabilities available:', !!room.router.rtpCapabilities)
      console.debug('Current producers in room:', currentProducers.length)

      acknowledgement({
        success: true,
        routerCapabilities: room.router.rtpCapabilities,
        producers: currentProducers.map((p) => ({
          id: p.id,
          kind: p.kind,
          userId: clientService.getClientByProducerId(p.id)?.userName,
        })),
      })

      // Notify other users in room
      socket.to(roomName).emit('user-joined', {
        userId: client.socketId,
        userName: client.userName,
      })
      console.groupEnd()
    } catch (error) {
      console.error('❌ join-room error:', error)
      acknowledgement({
        success: false,
        error: 'Failed to join room',
      })
    }
  }
