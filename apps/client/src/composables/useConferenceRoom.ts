import { Device } from 'mediasoup-client'
import { useSocket } from './useSocket'
import { useConsumer } from './room/useConsumer'
import { useMediaState } from './room/useMediaState'
import { useProducer } from './room/useProducer'
import { useRoomState } from './room/useRoomState'
import { createProducerSocketApi } from '../services/producerEventApi'
import { createProducerSignalingApi } from '../services/producerSignalingApi'
import { createConsumerSignalingApi } from '../services/consumerSignalingApi'
import type {
  ChatSocketApi,
  ConsumerSignalingApi,
  ProducerSignalingApi,
  ProducerSocketApi,
  UseChat,
} from '../types/types'
import { useChat } from './useChat'
import { createChatSocketApi } from '../services/chatSocketApi'
import { shallowRef, ref } from 'vue'
import { SOCKET_EVENTS, type JoinRoomRequest, type JoinRoomResponse } from '@mediasoup/types'
import type { RtpCapabilities } from 'mediasoup-client/types'

export function useConferenceRoom() {
  const socket = useSocket()

  let producerSignalingApi: ProducerSignalingApi
  let producerEventApi: ProducerSocketApi
  let consumerSignalingApi: ConsumerSignalingApi
  let chatSocketApi: ChatSocketApi

  const room = useRoomState()
  const media = useMediaState()
  const mediaState = {
    isAudioMuted: media.isAudioMuted,
    isVideoEnabled: media.isVideoEnabled,
    toggleAudioTrack: media.toggleAudioTrack,
    toggleVideoTrack: media.toggleVideoTrack,
  }

  let producer: ReturnType<typeof useProducer> | null = null
  let consumer: ReturnType<typeof useConsumer> | null = null
  const chat = shallowRef<UseChat | null>(null)

  const screenShareSocket = useSocket()
  let screenShareProducer: ReturnType<typeof useProducer> | null = null
  const isScreenShareActive = ref(false)
  let currentUserName = ''
  let currentRoomName = ''

  const joinRoom = async (userName: string, roomName: string) => {
    console.groupCollapsed(SOCKET_EVENTS.JOIN_ROOM)
    try {
      currentUserName = userName
      currentRoomName = roomName

      if (!socket.isConnected.value) {
        await socket.connect()
      }
      room.isJoining.value = true
      room.joinError.value = null

      console.debug('Joining room...')
      // TODO: TYPES join-room
      const payload: JoinRoomRequest = { userName: userName, roomId: roomName }
      const joinResp: JoinRoomResponse = await socket
        .getSocket()
        .emitWithAck(SOCKET_EVENTS.JOIN_ROOM, payload)
      console.debug(SOCKET_EVENTS.JOIN_ROOM, ' - resp :>> ', joinResp)

      if (!joinResp.success) {
        throw new Error(joinResp.error || 'Failed to join room')
      }

      producerSignalingApi = createProducerSignalingApi(socket.getSocket())
      producerEventApi = createProducerSocketApi(socket.getSocket())
      consumerSignalingApi = createConsumerSignalingApi(socket.getSocket())
      chatSocketApi = createChatSocketApi(socket.getSocket())

      const device = new Device()
      await device.load({ routerRtpCapabilities: joinResp.routerCapabilities as RtpCapabilities })

      producer = useProducer(producerSignalingApi, producerEventApi, mediaState)
      consumer = useConsumer(consumerSignalingApi, room.participants)

      await producer.requestProducerTransport(device)
      await consumer.requestConsumerTransports(joinResp.recentSpeakersData, device)
      consumer.setupDynamicConsumerListeners(device)

      chat.value = useChat(chatSocketApi)

      room.currentRoom.value = roomName
    } catch (error) {
      console.error('Failed to join room:', error)
      room.joinError.value = error instanceof Error ? error.message : 'Failed to join room'

      producer?.resetProducer()
      media.stopAll()
      chat.value?.clearMessages()
      room.resetRoom()

      throw error
    } finally {
      room.isJoining.value = false
      console.groupEnd()
    }
  }

  const leaveRoom = () => {
    if (socket.getSocket() && room.currentRoom.value) {
      // TODO: TYPES leave-room
      socket.getSocket().emit(SOCKET_EVENTS.LEAVE_ROOM)

      socket.getSocket().off('new-producer-to-consume')
      socket.getSocket().off('update-active-speakers')
      socket.getSocket().off('user-joined')
      socket.getSocket().off('user-left')
      socket.getSocket().off('participant-video-changed')
      socket.getSocket().off('participant-audio-changed')

      if (isScreenShareActive.value) {
        stopScreenShare()
      }

      chat.value?.cleanupChatListeners()
      chat.value?.clearMessages()
      chat.value = null

      producer?.resetProducer()
      media.stopAll()
      if (consumer) consumer.consumerTransports.value.forEach((transport) => transport.close())

      room.resetRoom()
      producer = null
      consumer = null
    }
  }

  const startAudio = async () => {
    if (!producer) throw new Error('Producer not ready')
    const stream = await media.startAudio()
    if (!producer.producerTransport.value) throw new Error('Producer transport not ready')
    await producer.startProducing(stream)
  }

  const startVideo = async () => {
    if (!producer) throw new Error('Producer not ready')
    const stream = await media.startVideo()
    if (!producer.producerTransport.value) throw new Error('Producer transport not ready.')
    await producer.startProducing(stream)
  }

  const toggleAudio = () => {
    if (!producer) return
    producer.toggleAudio()
  }

  const toggleVideo = () => {
    if (!producer) return
    producer.toggleVideo()
  }

  const toggleScreenShare = async () => {
    if (isScreenShareActive.value) {
      await stopScreenShare()
    } else {
      await startScreenShare()
    }
  }

  const startScreenShare = async () => {
    try {
      if (!screenShareSocket.isConnected.value) {
        await screenShareSocket.connect()
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false, // No audio for screen share
      })

      console.log(
        'Screen share stream tracks:',
        screenStream.getTracks().map((t) => ({ kind: t.kind, enabled: t.enabled }))
      )

      const screenShareUserName = `${currentUserName} - Screen Share`
      // TODO: TYPES join-room
      const payload: JoinRoomRequest = {
        userName: screenShareUserName,
        roomId: currentRoomName,
      }
      const joinResp = await screenShareSocket
        .getSocket()
        .emitWithAck(SOCKET_EVENTS.JOIN_ROOM, payload)

      if (!joinResp.success) {
        throw new Error(joinResp.error || 'Failed to join room as screen share client')
      }

      const screenShareSignalingApi = createProducerSignalingApi(screenShareSocket.getSocket())
      const screenShareEventApi = createProducerSocketApi(screenShareSocket.getSocket())

      const screenShareMediaState = {
        isAudioMuted: ref(true), // Always muted for screen share
        isVideoEnabled: ref(true),
        toggleAudioTrack: () => {}, // No audio toggle for screen share
        toggleVideoTrack: () => {},
      }

      screenShareProducer = useProducer(
        screenShareSignalingApi,
        screenShareEventApi,
        screenShareMediaState
      )

      const screenShareDevice = new Device()
      await screenShareDevice.load({ routerRtpCapabilities: joinResp.routerCapabilities })

      await screenShareProducer.requestProducerTransport(screenShareDevice)

      if (!screenShareProducer.producerTransport.value) {
        throw new Error('Screen share producer transport not ready')
      }

      const videoTrack = screenStream.getVideoTracks()[0]
      if (!videoTrack) {
        throw new Error('No video track in screen share stream')
      }

      console.log('Creating screen share video producer...')
      const transport = screenShareProducer.producerTransport.value as any
      const producer = await transport.produce({ track: videoTrack })

      screenShareProducer.videoProducer.value = producer

      console.log('Screen share producer created:', producer.id)

      videoTrack.addEventListener('ended', () => {
        console.log('Screen share ended by user')
        stopScreenShare()
      })

      isScreenShareActive.value = true
      media.isScreenSharing.value = true
      media.screenStream.value = screenStream

      console.log('Screen share started successfully')
    } catch (error) {
      console.error('Failed to start screen share:', error)
      await stopScreenShare() // Clean up on error
      throw error
    }
  }

  const stopScreenShare = async () => {
    try {
      if (screenShareSocket.isConnected.value) {
        // TODO: TYPES leave-room
        screenShareSocket.getSocket().emit(SOCKET_EVENTS.LEAVE_ROOM)
      }

      if (screenShareProducer?.videoProducer.value) {
        screenShareProducer.videoProducer.value.close()
      }
      if (screenShareProducer?.producerTransport.value) {
        screenShareProducer.producerTransport.value.close()
      }
      screenShareProducer = null

      if (media.screenStream.value) {
        media.screenStream.value.getTracks().forEach((track) => track.stop())
      }

      isScreenShareActive.value = false
      media.isScreenSharing.value = false
      media.screenStream.value = null

      console.log('Screen share stopped')
    } catch (error) {
      console.error('Error stopping screen share:', error)
    }
  }

  return {
    ...room,
    ...media,
    joinRoom,
    leaveRoom,
    startAudio,
    startVideo,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    isScreenShareActive,
    chat,
  }
}
