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
import { shallowRef } from 'vue'

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

  // Create a computed property that returns the chat instance or null
  // const chat = computed(() => chat)

  const joinRoom = async (userName: string, roomName: string) => {
    console.groupCollapsed('join-room')
    try {
      // Connect to server if not connected
      if (!socket.isConnected.value) {
        await socket.connect()
      }
      room.isJoining.value = true
      room.joinError.value = null

      // Join the room and get router capabilities
      console.debug('Joining room...')
      const joinResp = await socket.getSocket().emitWithAck('join-room', { userName, roomName })
      console.debug('join-room - resp :>> ', joinResp)

      if (!joinResp.success) {
        throw new Error(joinResp.error || 'Failed to join room')
      }

      // Create APIs
      producerSignalingApi = createProducerSignalingApi(socket.getSocket())
      producerEventApi = createProducerSocketApi(socket.getSocket())
      consumerSignalingApi = createConsumerSignalingApi(socket.getSocket())
      chatSocketApi = createChatSocketApi(socket.getSocket())

      // Create and load device
      const device = new Device()
      await device.load({ routerRtpCapabilities: joinResp.routerCapabilities })

      // Create producer and consumer
      producer = useProducer(producerSignalingApi, producerEventApi, mediaState)
      consumer = useConsumer(consumerSignalingApi, room.participants)

      // Set up transports and consumers
      await producer.requestProducerTransport(device)
      await consumer.requestConsumerTransports(joinResp.recentSpeakersData, device)
      consumer.setupDynamicConsumerListeners(device)

      // Setup chat
      chat.value = useChat(chatSocketApi)

      // Update room state
      room.currentRoom.value = roomName
    } catch (error) {
      console.error('Failed to join room:', error)
      room.joinError.value = error instanceof Error ? error.message : 'Failed to join room'

      // Cleanup on error
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
      socket.getSocket().emit('leave-room')

      // Remove socket listeners
      socket.getSocket().off('new-producer-to-consume')
      socket.getSocket().off('update-active-speakers')
      socket.getSocket().off('user-joined')
      socket.getSocket().off('user-left')
      socket.getSocket().off('participant-video-changed')
      socket.getSocket().off('participant-audio-changed')

      // Cleanup chat
      chat.value?.cleanupChatListeners()
      chat.value?.clearMessages()
      chat.value = null

      // Cleanup producer and consumer
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
    if (!producer) return

    if (!media.isScreenSharing.value) {
      const stream = await media.startScreenShare()
      await producer.startScreenShare(stream)
    } else {
      producer.stopScreenShare()
      media.stopScreenShare()
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
    chat,
  }
}
