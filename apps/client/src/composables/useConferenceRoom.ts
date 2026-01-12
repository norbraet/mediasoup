import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import { type CurrentProducer, type RoomParticipant } from '../types/types'
import { Device, types } from 'mediasoup-client'

export function useConferenceRoom() {
  const socket = useSocket()

  // Room
  const currentRoom = ref<string | null>(null)
  const participants = ref<Map<string, RoomParticipant>>(new Map())
  const isJoining = ref(false)
  const joinError = ref<string | null>(null)

  // Mediasoup
  const device = ref<Device | null>(null)
  const isDeviceReady = ref(false)
  const routerCapabilities = ref<types.RtpCapabilities | null>(null)
  const currentProducers = ref<CurrentProducer[]>([])

  // Media State
  const localStream = ref<MediaStream | null>(null)
  const localVideoRef = ref<HTMLVideoElement>()
  const isVideoEnabled = ref(false)
  const isAudioEnabled = ref(false)
  const isGettingMedia = ref(false)
  const mediaError = ref<string | null>(null)

  const joinRoom = async (userName: string, roomName: string) => {
    try {
      // 1. Connect to server if not connected
      if (!socket.isConnected.value) {
        console.debug('Socket not connected, connecting...')
        await socket.connect()
      }
      isJoining.value = true

      // 2. Join the room and get router capabilities
      console.debug('Joining room...')
      const resp = await socket.getSocket().emitWithAck('join-room', { userName, roomName })
      console.debug('join-room - resp :>> ', resp)

      if (!resp.success) {
        throw new Error(resp.error || 'Failed to join room')
      }

      // 3. Create and load device
      console.debug('Creating mediasoup device...')
      const newDevice = new Device()
      await newDevice.load({
        routerRtpCapabilities: resp.routerCapabilities,
      })

      // 4. Update the state
      device.value = newDevice
      isDeviceReady.value = true
      routerCapabilities.value = resp.routerCapabilities
      currentRoom.value = roomName
      currentProducers.value = resp.producers || []
    } catch (error) {
      console.error('Failed to join room:', error)
      joinError.value = error instanceof Error ? error.message : 'Failed to join room'

      // Cleanup on error
      device.value = null
      isDeviceReady.value = false
      currentRoom.value = null

      throw error
    } finally {
      isJoining.value = false
    }
  }

  const leaveRoom = () => {
    if (socket.getSocket() && currentRoom.value) {
      socket.getSocket().emit('leave-room')

      stopVideo()

      // Reset all state
      device.value = null
      isDeviceReady.value = false
      routerCapabilities.value = null
      currentRoom.value = null
      currentProducers.value = []
      participants.value.clear()
      joinError.value = null

      console.debug('Left room and cleaned up device')
    }
  }

  const startVideo = async (): Promise<void> => {
    if (!device.value?.loaded) {
      throw new Error('Device not ready. Join room first.')
    }

    isGettingMedia.value = true
    mediaError.value = null

    try {
      console.debug('Getting user media...')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStream.value = stream
      if (localVideoRef.value) localVideoRef.value.srcObject = stream

      // TODO: maybe i should save the videoTrack and the audioTrack since i need those in other functions as well
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      isVideoEnabled.value = videoTrack?.enabled || false
      isAudioEnabled.value = audioTrack?.enabled || false

      console.debug('Got user media successfully')
      console.debug('Video track:', !!videoTrack)
      console.debug('Audio track:', !!audioTrack)

      // TODO: Create producer transport and start producing
    } catch (error) {
      console.error('Failed to get user media:', error)
      mediaError.value = error instanceof Error ? error.message : 'Failed to access camera/mic'
      throw error
    } finally {
      isGettingMedia.value = false
    }
  }

  const stopVideo = (): void => {
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => {
        track.stop()
        console.debug('Stopped track:', track.kind)
      })
      localStream.value = null
    }

    if (localVideoRef.value) {
      localVideoRef.value.srcObject = null
    }

    isVideoEnabled.value = false
    isAudioEnabled.value = false

    console.debug('Stopped local stream')
  }

  const toggleVideo = (): void => {
    if (!localStream.value) return

    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoEnabled.value = videoTrack.enabled
      console.debug('Video toggled:', isVideoEnabled.value)
    }
  }

  const toggleAudio = (): void => {
    if (!localStream.value) return

    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioEnabled.value = audioTrack.enabled
      console.debug('Audio toggled:', isAudioEnabled.value)
    }
  }

  return {
    // Room State
    currentRoom: readonly(currentRoom),
    participants: readonly(participants),
    isJoining: readonly(isJoining),
    joinError: readonly(joinError),

    // WebRTC state
    device: readonly(device),
    isDeviceReady: readonly(isDeviceReady),
    routerCapabilities: readonly(routerCapabilities),
    currentProducers: readonly(currentProducers),

    // Socket state
    isConnected: socket.isConnected,
    isConnecting: socket.isConnecting,
    socket,

    // Media State
    localStream: readonly(localStream),
    localVideoRef,
    isVideoEnabled: readonly(isVideoEnabled),
    isAudioEnabled: readonly(isAudioEnabled),
    isGettingMedia: readonly(isGettingMedia),
    mediaError: readonly(mediaError),

    // Actions
    joinRoom,
    leaveRoom,
    startVideo,
    stopVideo,
    toggleVideo,
    toggleAudio,
  }
}
