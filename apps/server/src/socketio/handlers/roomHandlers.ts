import { Socket } from 'socket.io'
import {
  ClientService,
  JoinRoomAck,
  RequestTransportAck,
  RoomHandlers,
  RoomService,
  RoleType,
  ConnectTransportAck,
  StartProducingAck,
  RecentSpeakerData,
  ConsumeMediaAck,
  ClientConsumeMediaParams,
  ResumeConsumerAck,
} from '../../types'
import { createWebRtcTransport } from '../../mediasoup/createWebRtcTransport'
import { types } from 'mediasoup'
import env from '../../config/env'
import { updateActiveSpeakers } from '../../services/activeSpeakerService'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  return {
    'join-room': handleJoinRoom(socket, roomService, clientService),
    'request-transport': handleRequestTransport(socket, roomService, clientService),
    'connect-transport': handleConnectTransport(socket, clientService),
    'start-producing': handleStartProducing(socket, roomService, clientService),
    'audio-muted': handleAudioMuted(socket, clientService, roomService),
    'consume-media': handleConsumeMedia(socket, clientService, roomService),
    'unpause-consumer': handleUnpauseConsumer(socket, clientService),
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

      const recentSpeakersData = room
        .getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
        .map((socketId): RecentSpeakerData | null => {
          const client = [...room.clients.values()].find((client) => client.socketId === socketId)

          if (!client) {
            console.debug(`Client not found for socket ID: ${socketId}`)
            return null
          }

          let audioProducerId: string | null = null
          let videoProducerId: string | null = null

          for (const [producerId, producer] of client.producers) {
            if (producer.kind === 'audio') {
              audioProducerId = producerId
            } else if (producer.kind === 'video') {
              videoProducerId = producerId
            }
          }

          // Only return data if client has an audio producer (since they're in recent speakers)
          if (!audioProducerId) {
            console.debug(`Client ${client.userName} has no audio producer`)
            return null
          }

          return {
            audioProducerId: audioProducerId,
            videoProducerId: videoProducerId,
            userName: client.userName,
            userId: client.socketId,
          }
        })
        .filter((data): data is RecentSpeakerData => data !== null)

      console.debug('Successfully joined room')
      console.debug('Router capabilities available:', !!room.router.rtpCapabilities)
      console.debug('Recent speaker to consume:', recentSpeakersData)

      acknowledgement({
        success: true,
        routerCapabilities: room.router.rtpCapabilities,
        recentSpeakersData,
      })

      // TODO: Implement notififcation of other users in the room
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
  async (
    data: { type: RoleType; audioProducerId?: string },
    acknowledgement: RequestTransportAck
  ): Promise<void> => {
    try {
      console.debug('📡 Transport request:', data.type, 'for socket:', socket.id)
      const { type, audioProducerId } = data
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
        console.debug('Consumer transport clientTransportParams:', clientTransportParams)
        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      } else if (type === 'consumer') {
        console.debug('Creating consumer transport for:', client.userName)
        if (!audioProducerId) {
          acknowledgement({ success: false, error: 'Audio producer ID required for consumer' })
          return
        }
        const audioProducerClient = clientService.getClientByProducerId(audioProducerId)
        if (!audioProducerClient) {
          acknowledgement({ success: false, error: 'Audio producer not found' })
          return
        }

        if (audioProducerClient.roomId !== client.roomId) {
          acknowledgement({ success: false, error: 'Audio producer not in same room' })
          return
        }

        const audioProducer = audioProducerClient.producers.get(audioProducerId)
        if (!audioProducer || audioProducer.kind !== 'audio') {
          acknowledgement({ success: false, error: 'Invalid audio producer' })
          return
        }

        let videoProducerId: string | null = null
        for (const [producerId, producer] of audioProducerClient.producers) {
          if (producer.kind === 'video') {
            videoProducerId = producerId
            break
          }
        }

        const recentSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
        if (!recentSpeakers.includes(audioProducerClient.socketId)) {
          acknowledgement({ success: false, error: 'Producer not in recent speakers' })
          return
        }

        console.debug(`Found producer pair for ${audioProducerClient.userName}:`, {
          audio: audioProducerId,
          video: videoProducerId || 'none',
        })

        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.addConsumerTransport(transport, audioProducerId, videoProducerId)

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

const handleConnectTransport =
  (socket: Socket, clientService: ClientService) =>
  async (
    data: { dtlsParameters: types.DtlsParameters; type: RoleType; audioProducerId?: string },
    acknowledgement: ConnectTransportAck
  ): Promise<void> => {
    try {
      const { dtlsParameters, type, audioProducerId } = data
      const client = clientService.getClientBySocketId(socket.id)
      if (!client) {
        acknowledgement({ success: false, error: 'Client not found' })
        return
      }

      console.debug(`Connecting transport for ${client.userName} and it is a ${type}`)

      if (type === 'producer') {
        const transport = client.producerTransport
        if (!transport) {
          acknowledgement({ success: false, error: 'Producer transport not found' })
          return
        }
        await transport.connect({ dtlsParameters })
        acknowledgement({ success: true })
      } else if (type === 'consumer') {
        if (!audioProducerId) {
          acknowledgement({
            success: false,
            error: 'Audio producer ID required for consumer transport',
          })
          return
        }

        let targetTransport: types.WebRtcTransport | null = null
        for (const [, transportData] of client.consumerTransports) {
          if (transportData.associatedAudioProducerId === audioProducerId) {
            targetTransport = transportData.transport
            break
          }
        }

        if (!targetTransport) {
          console.debug('Consumer transport not found for audioProducerId:', audioProducerId)
          acknowledgement({
            success: false,
            error: 'Consumer transport not found for the given audioProducerId',
          })
          return
        }

        await targetTransport.connect({ dtlsParameters })
        acknowledgement({ success: true })
      }
    } catch (error) {
      console.error('connect-transport error:', error)
      acknowledgement({ success: false, error: 'connect-transport Error' })
    }
  }

const handleStartProducing =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (
    parameters: {
      kind: types.MediaKind
      rtpParameters: types.RtpParameters
      appData?: types.AppData
    },
    acknowledgement: StartProducingAck
  ): Promise<void> => {
    const client = clientService.getClientBySocketId(socket.id)
    if (!client) {
      console.debug('Client not found')
      acknowledgement({ success: false, error: 'Client not found' })
      return
    }

    const transport = client.producerTransport
    if (!transport) {
      console.debug('Transport not found')
      acknowledgement({ success: false, error: 'Transport not found' })
      return
    }

    if (!client.roomId) {
      console.debug('Client not in room')
      acknowledgement({ success: false, error: 'Client not in room' })
      return
    }

    const room = roomService.getRoomById(client.roomId)
    if (!room) {
      console.debug('Room not found')
      acknowledgement({ success: false, error: 'Room not found' })
      return
    }

    console.debug(`${client.userName} starting to produce ${parameters.kind}`)
    const producer = await transport.produce(parameters)
    client.addProducer(producer)

    if (parameters.kind === 'audio') {
      room.addProducerToActiveSpeaker(producer)
      console.debug(
        `Added audio producer ${producer.id} to active speaker observer for ${client.userName}`
      )
    }

    const newTransportsByPeer = updateActiveSpeakers(room, socket, clientService)
    for (const [socketId, audioProducerIds] of Object.entries(newTransportsByPeer)) {
      const speakerData: RecentSpeakerData[] = []

      for (const audioProducerId of audioProducerIds) {
        const producerClient = clientService.getClientByProducerId(audioProducerId)
        if (!producerClient) continue

        let videoProducerId: string | null = null
        for (const [producerId, producer] of producerClient.producers) {
          if (producer.kind === 'video') {
            videoProducerId = producerId
            break
          }
        }

        speakerData.push({
          audioProducerId,
          videoProducerId,
          userName: producerClient.userName,
          userId: producerClient.socketId,
        })
      }

      socket.to(socketId).emit('new-producer-to-consume', {
        routerRtpCapabilities: room.router.rtpCapabilities,
        recentSpeakersData: speakerData,
        activeSpeakerList: room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER),
      })
    }

    acknowledgement({ success: true, id: producer.id })
  }

const handleAudioMuted =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: { isAudioMuted: boolean }): void => {
    try {
      console.debug('Audio mute change requested:', data.isAudioMuted, 'for socket:', socket.id)

      const client = clientService.getClientBySocketId(socket.id)
      if (!client) {
        console.debug('Client not found for audio mute change')
        return
      }

      if (!client.roomId) {
        console.debug('Client not in room for audio mute change')
        return
      }

      const room = roomService.getRoomById(client.roomId)

      if (!room) {
        console.debug('Room not found for audio mute change')
        return
      }

      let audioProducer: types.Producer | null = null
      for (const [, producer] of client.producers) {
        if (producer.kind === 'audio') {
          audioProducer = producer
          break
        }
      }

      if (!audioProducer) {
        console.debug('No audio producer found for client:', client.userName)
        return
      }

      if (data.isAudioMuted) {
        audioProducer.pause()
        console.debug(`Paused audio producer for ${client.userName}`)
      } else {
        audioProducer.resume()
        console.debug(`Resumed audio producer for ${client.userName}`)
      }

      // TODO: Implement notification of other clients in the room about the mute state change
      /* socket.to(room.name).emit('participant-audio-changed', {
        userId: client.socketId,
        userName: client.userName,
        isAudioMuted: data.isAudioMuted,
      }) */

      console.debug(`Audio ${data.isAudioMuted ? 'muted' : 'unmuted'} for ${client.userName}`)
    } catch (error) {
      console.error('Error handling audio mute change:', error)
    }
  }

const handleConsumeMedia =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  async (
    data: {
      rtpCapabilities: types.RtpCapabilities
      producerId: string
      kind: types.MediaKind
    },
    acknowledgement: ConsumeMediaAck
  ): Promise<void> => {
    const { rtpCapabilities, producerId, kind } = data
    try {
      const client = clientService.getClientBySocketId(socket.id)
      if (!client) {
        console.debug('Client not found for consume media')
        acknowledgement({ success: false, error: 'Client not found' })
        return
      }
      if (!client?.roomId) {
        console.debug('Client not in room')
        acknowledgement({ success: false, error: 'Client not in room' })
        return
      }

      const room = roomService.getRoomById(client.roomId)
      if (!room) {
        console.debug('Room not found')
        acknowledgement({ success: false, error: 'Room not found' })
        return
      }

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        console.debug('Cannot consume')
        acknowledgement({ success: false, error: 'Cannot consume' })
        return
      }
      // TODO: I might need to check if the producer even exists. It is possible that the producer gets dropped or exits the room

      let targetTransport = null
      for (const [, transportData] of client.consumerTransports) {
        if (transportData.associatedAudioProducerId === producerId) {
          targetTransport = transportData.transport
          break
        } else if (transportData.associatedVideoProducerId === producerId) {
          targetTransport = transportData.transport
        }
      }

      if (!targetTransport) {
        console.debug('Target Transport not found')
        acknowledgement({ success: false, error: 'Target Transport not found' })
        return
      }

      const newConsumer = await targetTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      })

      client.addConsumer(newConsumer, kind, targetTransport)

      const clientParams: ClientConsumeMediaParams = {
        producerId: producerId,
        id: newConsumer.id,
        kind: newConsumer.kind,
        rtpParameters: newConsumer.rtpParameters,
      }

      acknowledgement({ success: true, params: clientParams })
    } catch (error) {
      console.error(error)
      acknowledgement({ success: false, error: 'Consume Media failed' })
    }
  }

const handleUnpauseConsumer =
  (socket: Socket, clientService: ClientService) =>
  async (
    data: { producerId: string; kind: types.MediaKind },
    acknowledgement: ResumeConsumerAck
  ): Promise<void> => {
    const { producerId, kind } = data

    try {
      const client = clientService.getClientBySocketId(socket.id)
      if (!client) {
        console.debug('Client not found for consume media')
        return
      }

      let targetConsumer: types.Consumer | undefined = undefined
      for (const [, transportData] of client.consumerTransports) {
        if (
          (transportData.associatedAudioProducerId === producerId && kind === 'audio') ||
          (transportData.associatedVideoProducerId === producerId && kind === 'video')
        ) {
          targetConsumer = transportData[kind]
          break
        }
      }

      if (!targetConsumer) {
        console.debug(`Consumer not found for producerId: ${producerId}, kind: ${kind}`)
        acknowledgement({ success: false, error: `Consumer not found for ${kind} producer` })
        return
      }

      if (!targetConsumer.paused) {
        console.debug(`Consumer for ${kind} producer ${producerId} is already resumed`)
        acknowledgement({ success: true })
        return
      }

      await targetConsumer.resume()
      console.debug(`Resumed ${kind} consumer for producer ${producerId}`)
      acknowledgement({ success: true })
    } catch (error) {
      console.error('Error unpausing consumer:', error)
      acknowledgement({ success: false, error: 'Failed to unpause consumer' })
    }
  }
