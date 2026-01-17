import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import { type CurrentProducer, type RoomParticipant } from '../types/types'
import { Device, types } from 'mediasoup-client'
import type { Socket } from 'socket.io-client'

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
  const isAudioMuted = ref(false)
  const isGettingMedia = ref(false)
  const mediaError = ref<string | null>(null)

  // Producer State
  const producerTransport = ref<types.Transport<types.AppData> | null>(null)
  const videoProducer = ref<types.Producer | null>(null)
  const audioProducer = ref<types.Producer | null>(null)

  // Room Management
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
      isAudioMuted.value = false

      console.debug('Left room and cleaned up device')
    }
  }

  // Media Managment
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
      isAudioMuted.value = false

      console.debug('Got user media successfully')
      console.debug('Video track:', !!videoTrack)
      console.debug('Audio track:', !!audioTrack)

      await startProducing()
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
    if (!audioProducer.value) {
      console.debug('No audio producer available, toggling track instead')
      toggleAudioTrack()
      return
    }

    try {
      if (isAudioMuted.value) {
        audioProducer.value.resume()
        isAudioMuted.value = false
      } else {
        audioProducer.value.pause()
        isAudioMuted.value = true
      }
      socket.getSocket().emit('audio-muted', { isAudioMuted: isAudioMuted.value })
      console.debug('Is audio producer producing:', isAudioMuted.value)
    } catch (error) {
      console.error('Failed to toggle audio producer. Fallback to track-level toggle:', error)
      toggleAudioTrack()
    }
  }

  // Fallback method for when producer is not available
  const toggleAudioTrack = (): void => {
    if (!localStream.value) return

    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioEnabled.value = audioTrack.enabled
      console.debug('Audio toggled:', isAudioEnabled.value)
    }
  }

  // Producer Mangamengt
  const startProducing = async (): Promise<void> => {
    if (!localStream.value) return

    try {
      console.debug('Starting to produce media...')
      if (!producerTransport.value) await createProducerTransport(socket.getSocket())

      await createProducer(
        localStream.value,
        producerTransport.value as types.Transport<types.AppData>
      )
      console.debug('Successfully started producing')
    } catch (error) {
      console.error('Failed to start producing:', error)
    }
  }

  const createProducerTransport = async (socket: Socket): Promise<void> => {
    console.debug('Creating producer transport...')
    //TODO: i should use a sharable type so the server knows what to expect
    const producerTransportParams = await socket.emitWithAck('request-transport', {
      type: 'producer',
    })
    console.debug(producerTransportParams)

    if (!device.value) {
      console.error('Missing device!')
      return
    }

    const transport = device.value.createSendTransport(producerTransportParams.params)
    producerTransport.value = transport
    producerTransport.value.on('connect', async ({ dtlsParameters }, callback, errback) => {
      // TODO: connectResp type should be a sharable type
      const connectResp = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: 'producer',
      })
      if (connectResp.success) {
        console.log('We are connected')
        callback()
      } else if (!connectResp.success) {
        errback(connectResp.error ?? 'General Error in connect-transport')
      }
    })

    producerTransport.value.on('produce', async (parameters, callback, errback) => {
      // TODO: produceResp type should be a sharable type
      const { kind, rtpParameters, appData } = parameters
      const produceResp = await socket.emitWithAck('start-producing', {
        kind,
        rtpParameters,
        appData,
      })

      if (!produceResp.success) {
        errback(produceResp.error ?? 'General start-producing error')
      } else if (produceResp.success) {
        callback({ id: produceResp.id })
      }
    })
    console.debug('videoProducer.value :>> ', videoProducer.value)
    console.debug('audioProducer.value :>> ', audioProducer.value)
  }

  const createProducer = async (
    localStream: MediaStream,
    producerTransport: types.Transport<types.AppData>
  ): Promise<void> => {
    const videoTrack = localStream.getVideoTracks()[0]
    const audioTrack = localStream.getAudioTracks()[0]

    try {
      if (videoTrack) {
        videoProducer.value = await producerTransport.produce({ track: videoTrack })
        console.debug('Video producer created')
      }
      if (audioTrack) {
        audioProducer.value = await producerTransport.produce({ track: audioTrack })
        console.debug('Audio producer created')

        // TODO: Check if this is needed since i already handle the ref toggle
        audioProducer.value.on('@pause', () => {
          isAudioMuted.value = true
          console.debug('Audio producer paused')
        })

        audioProducer.value.on('@resume', () => {
          isAudioMuted.value = false
          console.debug('Audio producer resumed')
        })
      }
    } catch (error) {
      console.error('Error producing:', error)
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
    isAudioMuted: readonly(isAudioMuted),
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
