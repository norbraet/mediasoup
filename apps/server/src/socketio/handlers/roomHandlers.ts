import { Socket } from 'socket.io'
import {
  ClientService,
  JoinRoomAck,
  RequestTransportAck,
  RoomHandlers,
  RoomService,
  RoleType,
} from '../../types'
import { createWebRtcTransport } from '../../mediasoup/createWebRtcTransport'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  return {
    'join-room': handleJoinRoom(socket, roomService, clientService),
    'request-transport': handleRequestTransport(socket, roomService, clientService),
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

const handleRequestTransport =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (data: { type: RoleType }, acknowledgement: RequestTransportAck): Promise<void> => {
    try {
      console.debug('📡 Transport request:', data.type, 'for socket:', socket.id)
      const { type } = data
      const client = clientService.getClientBySocketId(socket.id)

      if (!client) {
        console.debug('Client not found')
        acknowledgement({ success: false, error: 'Client not found' })
        return
      }
      if (!client?.roomId) {
        console.debug('Client not in room')
        acknowledgement({ success: false, error: 'Client not in room' })
        return
      }

      const room = roomService.getRoomById(client.roomId as string)
      if (!room) {
        console.debug('Room not found')
        acknowledgement({ success: false, error: 'Room not found' })
        return
      }

      if (type === 'producer') {
        console.debug('Creating producer transport for:', client.userName)
        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.setProducerTransport(transport)
        console.debug('clientTransportParams', clientTransportParams)
        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      } else if (type === 'consumer') {
        console.debug('Creating consumer transport for:', client.userName)
        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.addConsumerTransport(transport)
        console.debug('clientTransportParams', clientTransportParams)
        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      }
    } catch (error) {
      console.error('request-transport error:', error)
      acknowledgement({
        success: false,
        error: 'Failed to create transport',
      })
    }
  }
