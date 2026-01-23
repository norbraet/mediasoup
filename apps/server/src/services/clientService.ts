import { types } from 'mediasoup'
import { Client, ClientService, ConsumerTransport } from '../types'
import { Socket } from 'socket.io'
/* import env from '../config/env' */

function createClient(socket: Socket, userName: string): Client {
  const producers = new Map<string, types.Producer>() // The client will only have audio or video. I may consider to have an object of { audio?: ..., video?: ... } instead
  const consumerTransports = new Map<string, ConsumerTransport>() // This is our downstream transport
  let producerTransport: types.WebRtcTransport | null = null // This is the upstream transport
  let roomId: string | null = null

  return {
    socketId: socket.id,
    userName,
    producers,
    get roomId(): string | null {
      return roomId
    },
    get producerTransport(): types.WebRtcTransport | null {
      return producerTransport
    },
    get consumerTransports(): Map<string, ConsumerTransport> {
      return consumerTransports
    },
    setRoomId: (newRoomId: string): void => {
      roomId = newRoomId
    },
    setProducerTransport: (transport: types.WebRtcTransport): void => {
      producerTransport = transport
    },
    addConsumerTransport: (
      transport: types.WebRtcTransport,
      audioProducerId: string,
      videoProducerId: string | null
    ): void => {
      consumerTransports.set(transport.id, {
        transport: transport,
        associatedAudioProducerId: audioProducerId,
        associatedVideoProducerId: videoProducerId,
      })
    },

    removeConsumerTransport: (transportId: string): void => {
      const consumerTransport = consumerTransports.get(transportId)
      if (consumerTransport) {
        consumerTransport.transport.close()
        consumerTransports.delete(transportId)
      }
    },
    addProducer: (producer: types.Producer): void => {
      producers.set(producer.id, producer)
    },
    addConsumer: (
      consumer: types.Consumer,
      kind: types.MediaKind,
      transport: types.WebRtcTransport
    ): void => {
      for (const [, transportData] of consumerTransports) {
        if (transportData.transport.id === transport.id) {
          transportData[kind] = consumer
          break
        }
      }
    },
    cleanup: (): void => {
      producerTransport?.close()
      consumerTransports.forEach((consumerTransport) => consumerTransport.transport.close())
      consumerTransports.clear()
      producers.clear()
      roomId = null
    },
  }
}

export function createClientService(): ClientService {
  const clients = new Map<string, Client>()

  return {
    createClient: (socket: Socket, userName: string): Client => {
      const client = createClient(socket, userName)
      clients.set(client.socketId, client)
      return client
    },

    getClientBySocketId: (socketId: string): Client | undefined => {
      return clients.get(socketId)
    },

    getClientByProducerId: (producerId: string): Client | undefined => {
      for (const client of clients.values()) {
        if (client.producers.has(producerId)) {
          return client
        }
      }
      return undefined
    },

    removeClient: (socketId: string): void => {
      const client = clients.get(socketId)
      if (client) {
        client.cleanup()
        clients.delete(socketId)
      }
    },

    getAllClients: () => new Map(clients),
  }
}
