import { types } from 'mediasoup'
import { Client, ClientService } from '../types'
import { Socket } from 'socket.io'

function createClient(socket: Socket, userName: string): Client {
  const producers = new Map<string, types.Producer>() // The client will only have audio or video. I may consider to have an object of { audio?: ..., video?: ... } instead
  const consumers = new Map<string, types.Consumer>() // The client may consume 10 different feeds each of them with an audio and/or video track, so i need an array or a map
  const consumerTransports = new Map<string, types.WebRtcTransport>() // This is our downstream transport
  let roomId: string | null = null

  // This is the upstream transport
  let producerTransport: types.WebRtcTransport | null = null

  return {
    socketId: socket.id,
    userName,
    roomId,
    producerTransport,
    consumerTransports,
    producers,
    consumers,
    setRoomId: (newRoomId: string): void => {
      roomId = newRoomId
    },
    setProducerTransport: (transport: types.WebRtcTransport): void => {
      producerTransport = transport
    },
    addConsumerTransport: (transportId: string, transport: types.WebRtcTransport): void => {
      consumerTransports.set(transportId, transport)
    },

    removeConsumerTransport: (transportId: string): void => {
      const transport = consumerTransports.get(transportId)
      if (transport) {
        transport.close()
        consumerTransports.delete(transportId)
      }
    },
    addProducer: (producer: types.Producer): void => {
      producers.set(producer.id, producer)
    },
    addConsumer: (consumer: types.Consumer): void => {
      consumers.set(consumer.id, consumer)
    },
    cleanup: (): void => {
      producerTransport?.close()
      consumerTransports.forEach((transport) => transport.close())
      consumerTransports.clear()
      producers.clear()
      consumers.clear()
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
