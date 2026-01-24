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
import { getClientRoomContext } from '../../services/getClientRoomService'

export function createRoomHandlers(
  socket: Socket,
  roomService: RoomService,
  clientService: ClientService
): RoomHandlers {
  const activeSpeakerManager = createActiveSpeakerManager(clientService, socket)

  return {
    'join-room': handleJoinRoom(socket, roomService, clientService, activeSpeakerManager),
    'leave-room': handleLeaveRoom(socket, roomService, clientService),
    'request-transport': handleRequestTransport(socket, roomService, clientService),
    'connect-transport': handleConnectTransport(socket, clientService),
    'start-producing': handleStartProducing(socket, roomService, clientService),
    'audio-muted': handleAudioMuted(socket, clientService, roomService),
    'video-toggled': handleVideoToggled(socket, clientService, roomService),
    'consume-media': handleConsumeMedia(socket, clientService, roomService),
    'unpause-consumer': handleUnpauseConsumer(socket, clientService),
  }
}

const handleLeaveRoom =
  (socket: Socket, roomService: RoomService, clientService: ClientService) =>
  async (): Promise<void> => {
    try {
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) return
      const { client, room } = ctx

      // Remove client from room FIRST (this handles ActiveSpeakerObserver cleanup while producers still exist)
      room.removeClient(client.socketId)

      socket.leave(room.name)
      clientService.removeClient(client.socketId)
      // THEN close all transports (this will destroy the producers)
      if (client.producerTransport) client.producerTransport.close()

      for (const [, transportData] of client.consumerTransports) {
        transportData.transport.close()
      }

      // Notify other participants that user left
      socket.to(room.name).emit('user-left', {
        userId: client.socketId,
        userName: client.userName,
      })

      // If room is empty, clean it up
      if (room.clients.size === 0) {
        room.router.close()
        roomService.removeRoom(room.id)
      } else {
        const activeSpeakers = room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER)
        socket.to(room.name).emit('update-active-speakers', activeSpeakers)
      }
    } catch (error) {
      console.error('❌ leave-room error:', error)
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

      // Notify existing participants about the new joiner
      // They will need this info to create consumer transports when the new joiner starts producing
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
      const ctx = getClientRoomContext(socket, clientService, roomService)
      if (!ctx) {
        acknowledgement({ success: false, error: 'Client or Room not found' })
        return
      }
      const { client, room } = ctx
      const { type, audioProducerId } = data

      if (type === 'producer') {
        // Check if client already has a producer transport to prevent duplicates
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
      room.addProducerToActiveSpeaker(producer)
    } else {
      console.debug(`📹 This is VIDEO producer - not adding to active speaker observer`)
    }

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

      socket.to(socketId).emit('new-producer-to-consume', {
        routerRtpCapabilities: room.router.rtpCapabilities,
        recentSpeakersData: speakerData,
        activeSpeakerList: room.getRecentSpeakers(env.MAX_VISIBLE_ACTIVE_SPEAKER),
      })
    }

    acknowledgement({ success: true, id: producer.id })
  }

const handleVideoToggled =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: { isVideoEnabled: boolean }): void => {
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

      socket.to(room.name).emit('participant-video-changed', {
        userId: client.socketId,
        userName: client.userName,
        isVideoEnabled: data.isVideoEnabled,
      })
    } catch (error) {
      console.error('Error handling video toggle change:', error)
    }
  }

const handleAudioMuted =
  (socket: Socket, clientService: ClientService, roomService: RoomService) =>
  (data: { isAudioMuted: boolean }): void => {
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

      socket.to(room.name).emit('participant-audio-changed', {
        userId: client.socketId,
        userName: client.userName,
        isAudioMuted: data.isAudioMuted,
      })
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
