import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import { Device, types } from 'mediasoup-client'
import type { CurrentProducer, RoomParticipant, UseConferenceRoom } from '../types/types'
import type { Socket } from 'socket.io-client'

export function useConferenceRoom(): UseConferenceRoom {
  const socket = useSocket()

  // Room
  const currentRoom = ref<string | null>(null)
  const participants = ref<Map<string, RoomParticipant>>(new Map())
  const isJoining = ref(false)
  const joinError = ref<string | null>(null)

  // Mediasoup
  const device = ref<types.Device | null>(null)
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
    console.groupCollapsed('join-room')
    try {
      // 1. Connect to server if not connected
      if (!socket.isConnected.value) {
        // console.debug('Socket not connected, connecting...')
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

      // 5. Request producer transport for this client
      await requestProducerTransport(socket.getSocket())

      // 6. Request consumer transports for existing participants
      await requestConsumerTransports(
        resp.recentSpeakersData,
        socket.getSocket(),
        device.value as types.Device
      )

      setupDynamicConsumerListeners(socket.getSocket(), device.value as types.Device)
    } catch (error) {
      console.error('Failed to join room:', error)
      joinError.value = error instanceof Error ? error.message : 'Failed to join room'

      // Cleanup on error
      device.value = null
      isDeviceReady.value = false
      currentRoom.value = null
      producerTransport.value = null
      videoProducer.value = null
      audioProducer.value = null

      throw error
    } finally {
      isJoining.value = false
      console.groupEnd()
    }
  }

  const leaveRoom = () => {
    if (socket.getSocket() && currentRoom.value) {
      socket.getSocket().emit('leave-room')

      // Remove socket listeners
      socket.getSocket().off('new-producer-to-consume')
      socket.getSocket().off('update-active-speakers')
      socket.getSocket().off('user-joined')
      socket.getSocket().off('user-left')

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

      // Reset producer transport and producers
      producerTransport.value = null
      videoProducer.value = null
      audioProducer.value = null
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
      console.groupCollapsed('Getting user media...')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStream.value = stream
      if (localVideoRef.value) localVideoRef.value.srcObject = stream

      // TODO: maybe i should save the videoTrack and the audioTrack since i need those in other functions as well
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      isVideoEnabled.value = videoTrack?.enabled || false
      isAudioEnabled.value = audioTrack?.enabled || false
      isAudioMuted.value = false

      // Producer transport should already be available from joinRoom
      if (!producerTransport.value) {
        throw new Error(
          'Producer transport not available. This should have been created during room join.'
        )
      }

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
      })
      localStream.value = null
    }

    if (localVideoRef.value) {
      localVideoRef.value.srcObject = null
    }

    isVideoEnabled.value = false
    isAudioEnabled.value = false
  }

  const toggleVideo = (): void => {
    if (!localStream.value) return

    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoEnabled.value = videoTrack.enabled
    }
  }

  const toggleAudio = (): void => {
    if (!audioProducer.value) {
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
    }
  }

  // Producer Management
  const requestProducerTransport = async (socket: Socket): Promise<void> => {
    console.debug('Requesting producer transport...')
    const producerTransportParams = await socket.emitWithAck('request-transport', {
      type: 'producer',
    })
    console.debug('Producer transport params:', producerTransportParams)

    if (!device.value) {
      console.error('Missing device!')
      return
    }

    if (!producerTransportParams.success) {
      throw new Error(producerTransportParams.error || 'Failed to request producer transport')
    }

    // If transport already exists on server side, params might not be provided
    if (!producerTransportParams.params) {
      console.debug('Producer transport already exists on server, skipping client setup')
      return
    }

    const transport = device.value.createSendTransport(producerTransportParams.params)
    producerTransport.value = transport

    producerTransport.value.on('connect', async ({ dtlsParameters }, callback, errback) => {
      const connectResp = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: 'producer',
      })
      if (connectResp.success) {
        console.log('Producer transport connected')
        callback()
      } else {
        errback(connectResp.error ?? 'General Error in connect-transport')
      }
    })

    producerTransport.value.on('produce', async (parameters, callback, errback) => {
      const { kind, rtpParameters, appData } = parameters
      const produceResp = await socket.emitWithAck('start-producing', {
        kind,
        rtpParameters,
        appData,
      })

      if (!produceResp.success) {
        errback(produceResp.error ?? 'General start-producing error')
      } else {
        callback({ id: produceResp.id })
      }
    })
  }

  const startProducing = async (): Promise<void> => {
    if (!localStream.value) return
    if (!producerTransport.value) {
      throw new Error('Producer transport not available. Call requestProducerTransport first.')
    }

    try {
      await createProducer(
        localStream.value,
        producerTransport.value as types.Transport<types.AppData>
      )
    } catch (error) {
      console.error('Failed to start producing:', error)
    }
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
      }
      if (audioTrack) {
        audioProducer.value = await producerTransport.produce({ track: audioTrack })

        // TODO: Check if this is needed since i already handle the ref toggle
        audioProducer.value.on('@pause', () => {
          isAudioMuted.value = true
        })

        audioProducer.value.on('@resume', () => {
          isAudioMuted.value = false
        })
      }
    } catch (error) {
      console.error('Error producing:', error)
    }
  }

  const requestConsumerTransports = async (
    recentSpeakersData: Array<{
      audioProducerId: string
      videoProducerId: string | null
      userName: string
      userId: string
    }>,
    socket: Socket,
    device: types.Device | null
  ) => {
    console.groupCollapsed('requestConsumerTransports')
    console.log('Processing speakers:', recentSpeakersData.length)

    for (const [index, speaker] of recentSpeakersData.entries()) {
      console.log(`Processing speaker ${index + 1}/${recentSpeakersData.length}:`, {
        userName: speaker.userName,
        userId: speaker.userId,
        hasAudio: !!speaker.audioProducerId,
        hasVideo: !!speaker.videoProducerId,
      })
      try {
        // Skip participants without audio/video producers (they haven't started media yet)
        if (!speaker.audioProducerId && !speaker.videoProducerId) {
          // Still add them to participants map so they show up in UI
          participants.value.set(speaker.userId, {
            userId: speaker.userId,
            userName: speaker.userName,
            audioTrack: undefined,
            videoTrack: undefined,
            audioConsumer: undefined,
            videoConsumer: undefined,
          })
          continue
        }

        console.log(`Creating consumer transport for ${speaker.userName}...`)

        const consumerTransportParams = await socket.emitWithAck('request-transport', {
          type: 'consumer',
          audioProducerId: speaker.audioProducerId,
        })

        console.log('consumerTransportParams :>> ', consumerTransportParams)

        if (!consumerTransportParams || typeof consumerTransportParams !== 'object') {
          console.error(`Invalid response type for ${speaker.userName}:`, consumerTransportParams)
          continue
        }

        if (!consumerTransportParams.success) {
          console.error(
            `❌ Transport failed for ${speaker.userName}:`,
            consumerTransportParams.error
          )
          continue
        }

        if (!consumerTransportParams.params) {
          console.error(`No transport params received for ${speaker.userName}`)
          continue
        }

        console.log(`Valid transport params received for ${speaker.userName}`)

        const consumerTransport = createConsumerTransport(
          consumerTransportParams,
          socket,
          device,
          speaker.audioProducerId
        )

        const [audioConsumer, videoConsumer] = await Promise.all([
          createConsumer(
            consumerTransport,
            speaker.audioProducerId,
            device,
            socket,
            'audio',
            index
          ),
          createConsumer(
            consumerTransport,
            speaker.videoProducerId,
            device,
            socket,
            'video',
            index
          ),
        ])

        participants.value.set(speaker.userId, {
          userId: speaker.userId,
          userName: speaker.userName,
          audioTrack: audioConsumer?.track,
          videoTrack: videoConsumer?.track,
          audioConsumer: audioConsumer,
          videoConsumer: videoConsumer,
        })
      } catch (error) {
        console.error(`Error setting up consumer for ${speaker.userName}:`, error)
      }
    }
    console.groupEnd()
  }

  const createConsumer = async (
    consumerTransport: types.Transport<types.AppData>,
    producerId: string | null,
    device: types.Device | null,
    socket: Socket,
    kind: types.MediaKind,
    _index: number
  ): Promise<types.Consumer | undefined> => {
    const consumerParams = await socket.emitWithAck('consume-media', {
      rtpCapabilities: device?.rtpCapabilities,
      producerId,
      kind,
    })
    if (!consumerParams.success) {
      console.error(consumerParams.error || 'Failed to get consumer params')
      return
    }

    if (!consumerParams.params) {
      console.error('Got no consumer params from the server')
      return
    }

    const consumer = await consumerTransport.consume(consumerParams.params)
    console.log('consume() has finished!', consumer)
    await socket.emitWithAck('unpause-consumer', { producerId, kind })

    return consumer
  }

  const createConsumerTransport = (
    consumerTransportParams: {
      success: boolean
      params: {
        id: string
        iceParameters: types.IceParameters
        iceCandidates: types.IceCandidate[]
        dtlsParameters: types.DtlsParameters
      }
      error?: string
    },
    socket: Socket,
    device: types.Device | null,
    audioProducerId: string
  ) => {
    if (!device) throw new Error('No device found to create Consumer Transport')

    // Make a downstream transport for ONE producer/peer/client (with audio and video)
    const consumerTransport = device.createRecvTransport(consumerTransportParams.params)
    consumerTransport.on('connectionstatechange', (state) => {
      console.groupCollapsed('connectionstatechange')
      console.debug(state)
      console.groupEnd()
    })

    consumerTransport.on('icegatheringstatechange', (state) => {
      console.groupCollapsed('icegatheringstatechange')
      console.debug(state)
      console.groupEnd()
    })

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      const connectResp = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: 'consumer',
        audioProducerId,
      })

      if (connectResp.success) {
        callback()
      } else {
        errback(connectResp.error || 'Error in connect consumer transport')
      }
    })

    return consumerTransport
  }

  const setupDynamicConsumerListeners = (socket: Socket, device: types.Device) => {
    socket.on(
      'new-producer-to-consume',
      async (data: {
        routerRtpCapabilities: types.RtpCapabilities
        recentSpeakersData: Array<{
          audioProducerId: string
          videoProducerId: string | null
          userName: string
          userId: string
        }>
        activeSpeakerList: string[]
      }) => {
        console.log('New producers to consume:', data.recentSpeakersData)

        // Create consumer transports for new active speakers
        await requestConsumerTransports(data.recentSpeakersData, socket, device)
      }
    )

    socket.on('update-active-speakers', (activeSpeakerIds: string[]) => {
      console.log('Active speakers updated:', activeSpeakerIds)

      // Update participants with active speaker status
      for (const [userId, participant] of participants.value) {
        const isActiveSpeaker = activeSpeakerIds.includes(userId)
        participant.isActiveSpeaker = isActiveSpeaker
      }
    })

    socket.on('user-joined', (data: { userId: string; userName: string }) => {
      console.log('New user joined:', data.userName, data.userId)

      // Add the new user to participants map (without media tracks initially)
      // They will be updated when the user starts producing
      if (!participants.value.has(data.userId)) {
        participants.value.set(data.userId, {
          userId: data.userId,
          userName: data.userName,
          audioTrack: undefined,
          videoTrack: undefined,
          audioConsumer: undefined,
          videoConsumer: undefined,
        })
      }
    })

    socket.on('user-left', (data: { userId: string; userName: string }) => {
      console.log('User left:', data.userName, data.userId)

      // Remove the user from participants map
      participants.value.delete(data.userId)
    })
  }
  return {
    // Room State
    currentRoom: readonly(currentRoom),
    participants,
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
