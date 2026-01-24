import { Socket } from 'socket.io'
import { Client, ClientRoomContext, ClientService, Room, RoomService } from '../types'

export const withClientRoom = (
  socket: Socket,
  clientService: ClientService,
  roomService: RoomService,
  handler: (ctx: { client: Client; room: Room }) => Promise<void>
) => {
  return async (..._args: unknown[]): Promise<void | null> => {
    const ctx = getClientRoomContext(socket, clientService, roomService)
    if (!ctx) return
    await handler(ctx)
  }
}

export const getClientRoomContext = (
  socket: Socket,
  clientService: ClientService,
  roomService: RoomService
): ClientRoomContext | null => {
  const client = clientService.getClientBySocketId(socket.id)
  if (!client) {
    console.log('No client found with this socket.id:', socket.id)
    return null
  }

  if (!client.roomId) {
    console.log('Client is in no room:', client, 'and have this socket.id:', socket.id)
    return null
  }

  const room = roomService.getRoomById(client.roomId)
  if (!room) {
    console.log('Client is not in the requested room:', client.roomId)
    return null
  }

  return { client, room }
}
