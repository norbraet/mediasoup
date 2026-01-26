// Rooms are not a part of the concept of Mediasoup. Mediasoup itself cares about mediastreams, transports and things like that
import { types } from 'mediasoup'
import type { Client, Room, RoomService, WorkerPoolService } from '../types'
import { mediasoupConfig as msc } from '../config/config'
import env from '../config/env'

async function createRoom(roomName: string, workerPool: WorkerPoolService): Promise<Room> {
  // Create a new mediasoup service for this room (with its own router)
  const worker = workerPool.getWorkerForRoom(roomName)
  const router = await worker.createRouter({
    mediaCodecs: msc.router.mediaCodecs,
  })
  const activeSpeakerObserver = await router.createActiveSpeakerObserver({ interval: 300 }) // 300ms is the default value
  const clients = new Map<string, Client>()

  const activeSpeakerList = new Array<string>() // A array of id's with the most recent dominant speaker first
  const roomId = roomName

  activeSpeakerObserver.on('dominantspeaker', (dominantSpeaker) => {
    const client = Array.from(clients.values()).find((client) =>
      Array.from(client.producers.values()).some(
        (producer) => producer.id === dominantSpeaker.producer.id
      )
    )

    if (client) {
      const index = activeSpeakerList.indexOf(client.socketId)
      if (index > -1) activeSpeakerList.splice(index, 1)
      activeSpeakerList.unshift(client.socketId)
    } else {
      console.error(`❌ Could not find client for producer ${dominantSpeaker.producer.id}`)
    }
  })

  return {
    id: roomId,
    name: roomName,
    router,
    worker,
    clients,
    activeSpeakerObserver,

    addClient: (client: Client): void => {
      clients.set(client.socketId, client)
      client.setRoomId(roomId)
    },

    removeClient: (clientId: string): void => {
      const client = clients.get(clientId)
      if (client) {
        client.producers.forEach((producer) => {
          if (producer.kind === 'audio') {
            try {
              activeSpeakerObserver.removeProducer({ producerId: producer.id })
            } catch (error) {
              console.error(error)
            }
          }
        })
        client.cleanup()
        clients.delete(clientId)

        const index = activeSpeakerList.indexOf(clientId)
        if (index > -1) activeSpeakerList.splice(index, 1)
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

    getRecentSpeakers: (limit: number = env.MAX_VISIBLE_ACTIVE_SPEAKER): string[] => {
      const result = activeSpeakerList.slice(0, limit)
      console.log('result :>> ', result)
      console.log('activeSpeakerList :>> ', activeSpeakerList)
      return result
    },

    addProducerToActiveSpeaker: (producer: types.Producer): void => {
      if (producer.kind === 'audio') {
        try {
          activeSpeakerObserver.addProducer({ producerId: producer.id })

          // Find the client that owns this producer and add them to activeSpeakerList if not already there
          const client = Array.from(clients.values()).find((client) => {
            const hasProducer = Array.from(client.producers.values()).some(
              (p) => p.id === producer.id
            )
            console.debug(
              `Client ${client.socketId} (${client.userName}) has producer ${producer.id}:`,
              hasProducer
            )
            return hasProducer
          })

          if (!client) {
            console.error(`❌ Could not find client for producer ${producer.id}`)
          } else if (activeSpeakerList.includes(client.socketId)) {
            console.debug(`⚠️ Client ${client.socketId} already in activeSpeakerList`)
          } else {
            activeSpeakerList.push(client.socketId)
          }
        } catch (error) {
          console.error(
            `❌ Failed to add producer ${producer.id} to active speaker observer:`,
            error
          )
        }
      } else {
        console.debug(`📹 Skipping non-audio producer (${producer.kind})`)
      }
    },

    updateActiveSpeakerList: (newDominantSpeakerId: string): void => {
      const index = activeSpeakerList.indexOf(newDominantSpeakerId)
      if (index > -1) activeSpeakerList.splice(index, 1)
      activeSpeakerList.unshift(newDominantSpeakerId)
    },

    cleanup: (): void => {
      clients.forEach((client) => client.cleanup())
      clients.clear()
      activeSpeakerList.length = 0
      router.close()
    },

    getAllParticipantsForNewJoiner: (limit: number = env.MAX_VISIBLE_ACTIVE_SPEAKER): string[] => {
      const allClientIds = Array.from(clients.keys())
      const recentSpeakers = activeSpeakerList.slice(0, limit)
      const result = [...recentSpeakers]

      // Add screen share clients first (they should be visible)
      const screenShareClients = allClientIds.filter((id) => {
        const client = clients.get(id)
        return client && client.userName.includes(' - Screen Share')
      })

      // Add screen share clients that aren't already in result
      screenShareClients.forEach((screenShareId) => {
        if (!result.includes(screenShareId)) {
          result.push(screenShareId)
        }
      })

      // Fill remaining slots with other participants
      const remaining = limit - result.length

      if (remaining > 0) {
        const otherParticipants = allClientIds.filter((id) => !result.includes(id))
        const toAdd = otherParticipants.slice(0, remaining)

        result.push(...toAdd)
      }
      return result
    },
  }
}

export function createRoomService(workerPool: WorkerPoolService): RoomService {
  const rooms = new Map<string, Room>()

  return {
    createRoom: async (roomName: string): Promise<Room> => {
      const room = await createRoom(roomName, workerPool)
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

    getRoomStats: (): Array<{ roomName: string; clientCount: number; workerPid: string }> => {
      return Array.from(rooms.values()).map((room) => ({
        roomName: room.name,
        clientCount: room.getClientCount(),
        workerPid: room.worker.pid.toString(),
      }))
    },
  }
}
