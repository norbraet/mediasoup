// Rooms are not a part of the concept of Mediasoup. Mediasoup itself cares about mediastreams, transports and things like that
import { types } from 'mediasoup'
import type { Client, Room, RoomService, WorkerPoolService } from '../types'
import { mediasoupConfig as msc } from '../config/config'

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
    console.debug(`Dominant speaker changed in room "${roomName}":`, dominantSpeaker.producer.id)

    const client = Array.from(clients.values()).find((client) =>
      Array.from(client.producers.values()).some(
        (producer) => producer.id === dominantSpeaker.producer.id
      )
    )
    if (client) {
      const index = activeSpeakerList.indexOf(client.socketId)
      if (index > -1) activeSpeakerList.splice(index, 1)
      activeSpeakerList.unshift(client.socketId)

      // TODO: notify all clients in the room about the dominant speaker change. i need to setup a new event in my roomHandlers.ts and fire it from here
      // TODO: updateActiveSpeakers = mute/unmute/get new transport

      console.debug(`Dominant speaker in room "${roomName}": ${client.userName}`)
    }
  })

  console.debug(`Creating room "${roomName}" with worker PID: ${worker.pid}`)

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
      console.debug(
        `Added client "${client.userName}" to room "${roomName}" (${clients.size} total)`
      )
    },

    removeClient: (clientId: string): void => {
      const client = clients.get(clientId)
      if (client) {
        client.producers.forEach((producer) => {
          if (producer.kind === 'audio') {
            try {
              activeSpeakerObserver.removeProducer({ producerId: producer.id })
              console.debug(`Removed audio producer ${producer.id} from active speaker observer`)
            } catch (error) {
              console.debug(`Producer ${producer.id} was not in active speaker observer:`)
              console.error(error)
            }
          }
        })
        client.cleanup()
        clients.delete(clientId)

        const index = activeSpeakerList.indexOf(clientId)
        if (index > -1) activeSpeakerList.splice(index, 1)

        console.debug(`Removed client from room "${roomName}" (${clients.size} remaining)`)
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

    getActiveSpeaker: (): string | undefined => activeSpeakerList[0],

    addProducerToActiveSpeaker: (producer: types.Producer): void => {
      if (producer.kind === 'audio') {
        try {
          activeSpeakerObserver.addProducer({ producerId: producer.id })
          console.debug(`Added audio producer ${producer.id} to active speaker observer`)
        } catch (error) {
          console.error(`Failed to add producer ${producer.id} to active speaker observer:`, error)
        }
      }
    },

    cleanup: (): void => {
      console.debug(`Cleaning up room "${roomName}" on worker ${worker.pid}`)
      clients.forEach((client) => client.cleanup())
      clients.clear()
      router.close()
    },
  }
}

export function createRoomService(workerPool: WorkerPoolService): RoomService {
  const rooms = new Map<string, Room>()

  return {
    createRoom: async (roomName: string): Promise<Room> => {
      const room = await createRoom(roomName, workerPool)
      rooms.set(room.id, room)
      console.log(`Created room "${roomName}" (${rooms.size} total rooms)`)
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
        console.log(`Removed room "${room.name}" (${rooms.size} remaining)`)
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
