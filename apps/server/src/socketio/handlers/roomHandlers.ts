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
  ActiveSpeakerManager,
} from '../../types'
import { createWebRtcTransport } from '../../mediasoup/createWebRtcTransport'
import { types } from 'mediasoup'
import env from '../../config/env'
import { updateActiveSpeakers } from '../../services/activeSpeakerService'
import { createActiveSpeakerManager } from '../../services/activeSpeakerManager'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  const activeSpeakerManager = createActiveSpeakerManager(clientService, socket)

  return {
    'join-room': handleJoinRoom(socket, roomService, clientService, activeSpeakerManager),
    'request-transport': handleRequestTransport(socket, roomService, clientService),
    'connect-transport': handleConnectTransport(socket, clientService),
    'start-producing': handleStartProducing(socket, roomService, clientService),
    'audio-muted': handleAudioMuted(socket, clientService, roomService),
    'consume-media': handleConsumeMedia(socket, clientService, roomService),
    'unpause-consumer': handleUnpauseConsumer(socket, clientService),
  }
}

const handleJoinRoom =
  (
    socket: Socket,
    roomService: RoomService,
    clientService: ClientService,
    activeSpeakerManager: ActiveSpeakerManager
  ) =>
  async (
    data: { userName: string; roomName: string },
    acknowledgement: JoinRoomAck
  ): Promise<void> => {
    try {
      console.debug(
        '\n========== Socket Event: join-room | roomHandlers -> handleJoinRoom ==========\n'
      )
      console.debug('User:', data.userName)
      console.debug('Room:', data.roomName)
      console.debug('Socket ID:', socket.id)

      const { userName, roomName } = data

      const client = clientService.createClient(socket, userName)

      // Get or create room (room has the router)
      let room = roomService.getRoomByName(roomName)
      if (!room) {
        room = await roomService.createRoom(roomName, clientService, socket)
        activeSpeakerManager.setupActiveSpeakerHandling(room)
      }

      room.addClient(client)
      socket.join(roomName)

      const recentSpeakersData = room
        .getAllParticipantsForNewJoiner(env.MAX_VISIBLE_ACTIVE_SPEAKER)
        .filter((socketId) => socketId !== socket.id)
        .map((socketId): RecentSpeakerData | null => {
          const remoteClient = [...room.clients.values()].find(
            (client) => client.socketId === socketId
          )

          if (!remoteClient) {
            console.debug('❌ Client not found for socketId:', socketId)
            return null
          }

          let audioProducerId: string | null = null
          let videoProducerId: string | null = null

          for (const [producerId, producer] of remoteClient.producers) {
            if (producer.kind === 'audio') {
              audioProducerId = producerId
            } else if (producer.kind === 'video') {
              videoProducerId = producerId
            }
          }

          return {
            audioProducerId: audioProducerId,
            videoProducerId: videoProducerId,
            userName: remoteClient.userName,
            userId: remoteClient.socketId,
          }
        })
        .filter((data): data is RecentSpeakerData => data !== null)

      console.debug(
        `📤 Final recentSpeakersData for new joiner (${recentSpeakersData.length} total):`,
        recentSpeakersData.map((p) => ({
          userName: p.userName,
          userId: p.userId,
          hasAudio: !!p.audioProducerId,
          hasVideo: !!p.videoProducerId,
        }))
      )
      console.debug('Successfully joined room')
      console.debug('Router capabilities available:', !!room.router.rtpCapabilities)
      console.debug('Recent speaker to consume:', recentSpeakersData)
      console.debug('\n========== Socket Event: join-room | END ==========\n')

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
      console.debug(
        '\n========== Socket Event: request-transport | roomHandlers -> handleRequestTransport ==========\n'
      )
      const { type, audioProducerId } = data
      const client = clientService.getClientBySocketId(socket.id)

      if (!client) {
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
        acknowledgement({ success: false, error: 'Room not found' })
        return
      }

      if (type === 'producer') {
        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.setProducerTransport(transport)

        console.debug('Consumer transport clientTransportParams:', clientTransportParams)

        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      } else if (type === 'consumer') {
        if (!audioProducerId) {
          console.error(
            `❌ Consumer transport request missing audioProducerId for ${client.userName}`
          )
          acknowledgement({ success: false, error: 'Audio producer ID required for consumer' })
          return
        }
        const audioProducerClient = clientService.getClientByProducerId(audioProducerId)
        if (!audioProducerClient) {
          console.error(`❌ Audio producer ${audioProducerId} not found for ${client.userName}`)
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
      acknowledgement({ success: false, error: 'Client not found' })
      return
    }

    const transport = client.producerTransport
    if (!transport) {
      acknowledgement({ success: false, error: 'Transport not found' })
      return
    }

    if (!client.roomId) {
      acknowledgement({ success: false, error: 'Client not in room' })
      return
    }

    const room = roomService.getRoomById(client.roomId)
    if (!room) {
      acknowledgement({ success: false, error: 'Room not found' })
      return
    }
    const producer = await transport.produce(parameters)
    client.addProducer(producer)

    if (parameters.kind === 'audio') {
      room.addProducerToActiveSpeaker(producer)
    } else {
      console.debug(`📹 This is VIDEO producer - not adding to active speaker observer`)
    }
    const newTransportsByPeer = await updateActiveSpeakers(room, socket, clientService)
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
      // console.debug('Audio mute change requested:', data.isAudioMuted, 'for socket:', socket.id)

      const client = clientService.getClientBySocketId(socket.id)
      if (!client) {
        // console.debug('Client not found for audio mute change')
        return
      }

      if (!client.roomId) {
        // console.debug('Client not in room for audio mute change')
        return
      }

      const room = roomService.getRoomById(client.roomId)

      if (!room) {
        // console.debug('Room not found for audio mute change')
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
        // console.debug('No audio producer found for client:', client.userName)
        return
      }

      if (data.isAudioMuted) {
        audioProducer.pause()
        // console.debug(`Paused audio producer for ${client.userName}`)
      } else {
        audioProducer.resume()
        // console.debug(`Resumed audio producer for ${client.userName}`)
      }

      // TODO: Implement notification of other clients in the room about the mute state change
      /* socket.to(room.name).emit('participant-audio-changed', {
        userId: client.socketId,
        userName: client.userName,
        isAudioMuted: data.isAudioMuted,
      }) */
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
        acknowledgement({ success: false, error: 'Client not found' })
        return
      }
      if (!client?.roomId) {
        acknowledgement({ success: false, error: 'Client not in room' })
        return
      }

      const room = roomService.getRoomById(client.roomId)
      if (!room) {
        acknowledgement({ success: false, error: 'Room not found' })
        return
      }

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        console.error(
          `❌ Cannot consume ${kind} from producer ${producerId} for ${client?.userName || socket.id}`
        )
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
        // console.debug('Client not found for consume media')
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
        acknowledgement({ success: false, error: `Consumer not found for ${kind} producer` })
        return
      }

      if (!targetConsumer.paused) {
        acknowledgement({ success: true })
        return
      }

      await targetConsumer.resume()
      acknowledgement({ success: true })
    } catch (error) {
      console.error('Error unpausing consumer:', error)
      acknowledgement({ success: false, error: 'Failed to unpause consumer' })
    }
  }
