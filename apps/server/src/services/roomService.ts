import { types } from 'mediasoup'
import { createMediasoupService } from './mediasoupService'
import type { Client, Room, RoomService } from '../types'

async function createRoom(roomName: string): Promise<Room> {
  // Create a new mediasoup service for this room (with its own router)
  const mediasoupService = await createMediasoupService()
  const router = mediasoupService.getRouter()

  const clients = new Map<string, Client>()
  const roomId = roomName

  return {
    id: roomId,
    name: roomName,
    router,
    clients,

    addClient: (client: Client): void => {
      clients.set(client.socketId, client)
      client.setRoomId(roomId)
    },

    removeClient: (clientId: string): void => {
      const client = clients.get(clientId)
      if (client) {
        client.cleanup()
        clients.delete(clientId)
      }
    },

    getProducers: (): types.Producer[] => {
      const producers: types.Producer[] = []
      clients.forEach((client) => {
        client.producers.forEach((producer) => producers.push(producer))
      })
      return producers
    },

    getClientCount: () => clients.size,

    cleanup: (): void => {
      clients.forEach((client) => client.cleanup())
      clients.clear()
      router.close()
    },
  }
}

export function createRoomService(): RoomService {
  const rooms = new Map<string, Room>()

  return {
    createRoom: async (roomName: string): Promise<Room> => {
      const room = await createRoom(roomName)
      rooms.set(room.id, room)
      return room
    },

    getRoomByName: (roomName: string): Room | undefined => {
      for (const room of rooms.values()) {
        if (room.name === roomName) {
          return room
        }
      }
      return undefined
    },

    getRoomById: (roomId: string): Room | undefined => {
      return rooms.get(roomId)
    },

    removeRoom: (roomId: string): void => {
      const room = rooms.get(roomId)
      if (room) {
        room.cleanup()
        rooms.delete(roomId)
      }
    },

    getAllRooms: () => new Map(rooms),
  }
}
