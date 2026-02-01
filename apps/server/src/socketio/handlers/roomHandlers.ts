import { Socket } from 'socket.io'
import {
  ClientService,
  JoinRoomAck,
  RequestTransportAck,
  RoomHandlers,
  RoomService,
  ConnectTransportAck,
  StartProducingAck,
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
import { getClientRoomContext } from '../../services/getClientRoomService'
import {
  AudioMutedData,
  ChatMessage,
  JoinRoomRequest,
  RequestTransportData,
  Role,
  SendChatMessageData,
  SOCKET_EVENTS,
  VideoToggledData,
  type RecentSpeakerData,
  type RoleType,
} from '@mediasoup/types'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  const activeSpeakerManager = createActiveSpeakerManager(clientService, socket)

  return {
    [SOCKET_EVENTS.JOIN_ROOM]: handleJoinRoom(
      socket,
      roomService,
      clientService,
      activeSpeakerManager
    ),
    [SOCKET_EVENTS.LEAVE_ROOM]: handleLeaveRoom(socket, roomService, clientService),
    [SOCKET_EVENTS.REQUEST_TRANSPORT]: handleRequestTransport(socket, roomService, clientService),
    [SOCKET_EVENTS.CONNECT_TRANSPORT]: handleConnectTransport(socket, clientService),
    [SOCKET_EVENTS.START_PRODUCING]: handleStartProducing(socket, roomService, clientService),
    [SOCKET_EVENTS.AUDIO_MUTED]: handleAudioMuted(socket, clientService, roomService),
    [SOCKET_EVENTS.VIDEO_TOGGLED]: handleVideoToggled(socket, clientService, roomService),
    [SOCKET_EVENTS.CONSUME_MEDIA]: handleConsumeMedia(socket, clientService, roomService),
    [SOCKET_EVENTS.UNPAUSE_CONSUMER]: handleUnpauseConsumer(socket, clientService),
    [SOCKET_EVENTS.CHAT_MESSAGE]: handleChatMessage(socket, clientService, roomService),
  }
}

// TODO: TYPES leave-room
const handleLeaveRoom =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (): Promise<void> => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) return
      const { client, room } = ctx

      room.removeClient(client.socketId)

      socket.leave(room.name)
      clientService.removeClient(client.socketId)
      if (client.producerTransport) client.producerTransport.close()

      for (const [, transportData] of client.consumerTransports) {
        transportData.transport.close()
      }

      // TODO: TYPES user-left
      socket.to(room.name).emit('user-left', {
        userId: client.socketId,
        userName: client.userName,
      })

      if (room.clients.size === 0) {
        room.router.close()
        roomService.removeRoom(room.id)
      } else {
        const activeSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
        // TODO: TYPES update-active-speakers
        socket.to(room.name).emit('update-active-speakers', activeSpeakers)
      }
    } catch (error) {
      console.error('❌ ', SOCKET_EVENTS.LEAVE_ROOM, 'error:', error)
    }
  }

// TODO: TYPES join-room
const handleJoinRoom =
  (
    socket: Socket,
    roomService: RoomService,
    clientService: ClientService,
    activeSpeakerManager: ActiveSpeakerManager
  ) =>
  async (data: JoinRoomRequest, acknowledgement: JoinRoomAck): Promise<void> => {
    try {
      const { userName, roomId } = data
      const isScreenShare = userName.includes(' - Screen Share')
      const client = clientService.createClient(socket, userName)

      if (isScreenShare) {
        console.debug('📺 Screen share client joining:', userName)
      }

      let room = roomService.getRoomByName(roomId)
      if (!room) {
        room = await roomService.createRoom(roomId, clientService, socket)
        activeSpeakerManager.setupActiveSpeakerHandling(room)
      }

      room.addClient(client)
      socket.join(roomId)

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
            if (producer.kind === 'audio') audioProducerId = producerId
            else if (producer.kind === 'video') videoProducerId = producerId
          }

          return {
            audioProducerId: audioProducerId,
            videoProducerId: videoProducerId,
            userName: remoteClient.userName,
            userId: remoteClient.socketId,
          }
        })
        .filter((data): data is RecentSpeakerData => data !== null)

      acknowledgement({
        success: true,
        routerCapabilities: room.router.rtpCapabilities,
        recentSpeakersData,
      })

      // TODO: TYPES user-joined
      socket.to(roomId).emit('user-joined', {
        userId: client.socketId,
        userName: client.userName,
      })
    } catch (error) {
      console.error('❌', SOCKET_EVENTS.JOIN_ROOM, ' error:', error)
      acknowledgement({
        success: false,
        error: 'Failed to join room',
      })
    }
  }

// TODO: TYPES request-transport
const handleRequestTransport =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (data: RequestTransportData, acknowledgement: RequestTransportAck): Promise<void> => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) {
        acknowledgement({ success: false, error: 'Client or Room not found' })
        return
      }
      const { client, room } = ctx
      const { type, audioProducerId } = data

      if (type === Role.Producer) {
        if (client.producerTransport) {
          acknowledgement({
            success: true,
            error: 'Producer transport already exists',
          })
          return
        }

        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.setProducerTransport(transport)

        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      } else if (type === 'consumer') {
        if (!audioProducerId) {
          console.error(`❌ Consumer transport request missing producerId for ${client.userName}`)
          acknowledgement({ success: false, error: 'Producer ID required for consumer' })
          return
        }

        const producerClient = clientService.getClientByProducerId(audioProducerId)
        if (!producerClient) {
          console.error(`❌ Producer ${audioProducerId} not found for ${client.userName}`)
          acknowledgement({ success: false, error: 'Producer not found' })
          return
        }

        if (producerClient.roomId !== client.roomId) {
          acknowledgement({ success: false, error: 'Producer not in same room' })
          return
        }

        const producer = producerClient.producers.get(audioProducerId)
        if (!producer) {
          acknowledgement({ success: false, error: 'Invalid producer' })
          return
        }

        const isScreenShare = producerClient.userName.includes(' - Screen Share')
        let actualAudioProducerId: string | null = null
        let videoProducerId: string | null = null

        if (isScreenShare) {
          videoProducerId = producer.kind === 'video' ? producer.id : null
        } else {
          actualAudioProducerId = producer.kind === 'audio' ? producer.id : null
          for (const [producerId, prod] of producerClient.producers) {
            if (prod.kind === 'video') {
              videoProducerId = producerId
              break
            }
          }
        }

        if (!isScreenShare) {
          const recentSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
          if (!recentSpeakers.includes(producerClient.socketId)) {
            acknowledgement({ success: false, error: 'Producer not in recent speakers' })
            return
          }
        }

        const { transport, clientTransportParams } = await createWebRtcTransport(room.router)
        client.addConsumerTransport(
          transport,
          actualAudioProducerId || audioProducerId,
          videoProducerId
        )

        acknowledgement({
          success: true,
          params: clientTransportParams,
        })
      }
    } catch (error) {
      console.error(SOCKET_EVENTS.REQUEST_TRANSPORT, ' error:', error)
      acknowledgement({
        success: false,
        error: 'Failed to create transport',
      })
    }
  }

// TODO: TYPES connect-transport
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

      if (type === Role.Producer) {
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
            error: 'Producer ID required for consumer transport',
          })
          return
        }

        let targetTransport: types.WebRtcTransport | null = null
        for (const [, transportData] of client.consumerTransports) {
          if (
            transportData.associatedAudioProducerId === audioProducerId ||
            transportData.associatedVideoProducerId === audioProducerId
          ) {
            targetTransport = transportData.transport
            break
          }
        }

        if (!targetTransport) {
          acknowledgement({
            success: false,
            error: 'Consumer transport not found for the given producerId',
          })
          return
        }

        await targetTransport.connect({ dtlsParameters })
        acknowledgement({ success: true })
      }
    } catch (error) {
      console.error(SOCKET_EVENTS.CONNECT_TRANSPORT, ' error:', error)
      acknowledgement({ success: false, error: `${SOCKET_EVENTS.CONNECT_TRANSPORT} Error` })
    }
  }

// TODO: TYPES connect-transport
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
    const ctx = getClientRoomContext(socket, clientService, roomService)
    if (!ctx) {
      acknowledgement({ success: false, error: 'Client or Room not found' })
      return
    }
    const { client, room } = ctx
    const transport = client.producerTransport
    if (!transport) {
      acknowledgement({ success: false, error: 'Transport not found' })
      return
    }
    const producer = await transport.produce(parameters)
    client.addProducer(producer)

    // TODO: Check if this is still needed
    if (parameters.kind === 'audio') {
      const isScreenShare = client.userName.includes(' - Screen Share')
      if (!isScreenShare) {
        room.addProducerToActiveSpeaker(producer)
      } else {
        console.debug('📺 Screen share client - not adding to active speaker observer')
      }
    } else {
      console.debug(`📹 This is VIDEO producer - not adding to active speaker observer`)
    }

    const isScreenShare = client.userName.includes(' - Screen Share')
    if (isScreenShare && parameters.kind === 'video') {
      console.log('🖥️ Screen share video producer created, notifying all clients')

      const screenShareSpeakerData: RecentSpeakerData = {
        audioProducerId: null, // Screen share has no audio
        videoProducerId: producer.id,
        userName: client.userName,
        userId: client.socketId,
      }

      // TODO: TYPES new-producer-to-consume
      socket.to(room.name).emit('new-producer-to-consume', {
        routerRtpCapabilities: room.router.rtpCapabilities,
        recentSpeakersData: [screenShareSpeakerData],
        activeSpeakerList: room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER),
      })
    } else {
      const newTransportsByPeer = await updateActiveSpeakers(room, socket, clientService)

      for (const [socketId, audioProducerIds] of Object.entries(newTransportsByPeer)) {
        const speakerData: RecentSpeakerData[] = []

        for (const audioProducerId of audioProducerIds) {
          const producerClient = clientService.getClientByProducerId(audioProducerId)
          if (!producerClient) {
            console.warn(`Producer client not found for audioProducerId: ${audioProducerId}`)
            continue
          }

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

        // TODO: TYPES new-producer-to-consume
        socket.to(socketId).emit('new-producer-to-consume', {
          routerRtpCapabilities: room.router.rtpCapabilities,
          recentSpeakersData: speakerData,
          activeSpeakerList: room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER),
        })
      }
    }

    acknowledgement({ success: true, id: producer.id })
  }

// TODO: TYPES video-toggled
const handleVideoToggled =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: VideoToggledData): void => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) return
      const { client, room } = ctx

      let videoProducer: types.Producer | null = null
      for (const [, producer] of client.producers) {
        if (producer.kind === 'video') {
          videoProducer = producer
          break
        }
      }
      if (!videoProducer) return

      if (data.isVideoEnabled) videoProducer.resume()
      else videoProducer.pause()

      // TODO: TYPES participant-video-changed
      socket.to(room.name).emit('participant-video-changed', {
        userId: client.socketId,
        userName: client.userName,
        isVideoEnabled: data.isVideoEnabled,
      })
    } catch (error) {
      console.error('Error handling video toggle change:', error)
    }
  }

// TODO: TYPES audio-muted
const handleAudioMuted =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: AudioMutedData): void => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) return
      const { client, room } = ctx

      let audioProducer: types.Producer | null = null
      for (const [, producer] of client.producers) {
        if (producer.kind === 'audio') {
          audioProducer = producer
          break
        }
      }

      if (!audioProducer) return

      if (data.isAudioMuted) audioProducer.pause()
      else audioProducer.resume()

      // TODO: TYPES participant-audio-changed
      socket.to(room.name).emit('participant-audio-changed', {
        userId: client.socketId,
        userName: client.userName,
        isAudioMuted: data.isAudioMuted,
      })
    } catch (error) {
      console.error('Error handling audio mute change:', error)
    }
  }

// TODO: TYPES consume-media
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
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) {
        acknowledgement({ success: false, error: 'Client or Room not found' })
        return
      }
      const { client, room } = ctx

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

// TODO: TYPES unpause-consumer
const handleUnpauseConsumer =
  (socket: Socket, clientService: ClientService) =>
  async (
    data: { producerId: string; kind: types.MediaKind },
    acknowledgement: ResumeConsumerAck
  ): Promise<void> => {
    const { producerId, kind } = data
    const client = clientService.getClientBySocketId(socket.id)
    if (!client) {
      acknowledgement({ success: false, error: 'Client not found' })
      return
    }
    let targetConsumer: types.Consumer | undefined = undefined

    try {
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

// TODO: TYPES chat-message
const handleChatMessage =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: SendChatMessageData): void => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) {
        console.warn('Chat message from client not in room:', socket.id)
        return
      }
      const { client, room } = ctx

      if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
        console.warn('Invalid chat message from client:', client.socketId)
        return
      }

      if (data.roomId !== room.name) {
        console.warn('Chat message roomId mismatch:', {
          expected: room.name,
          received: data.roomId,
        })
        return
      }

      const chatMessage: ChatMessage = {
        userId: client.socketId,
        userName: client.userName,
        message: data.message.trim(),
        timestamp: data.timestamp || Date.now(),
      }

      // TODO: TYPES chat-message
      socket.to(room.name).emit('chat-message', chatMessage)
      socket.emit('chat-message', chatMessage) // Echo back to sender for consistency

      console.debug(`💬 Chat message in ${room.name}: ${client.userName}: ${chatMessage.message}`)
    } catch (error) {
      console.error('Error handling chat message:', error)
    }
  }
