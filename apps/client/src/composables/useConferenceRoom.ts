import { readonly, ref } from 'vue'
import { useSocket } from './useSocket'
import { Device, types } from 'mediasoup-client'
import { env } from '../config/env'
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

      await requestTransportToConsume(
        resp.recentSpeakersData,
        socket.getSocket(),
        device.value as types.Device
      )

      setupDynamicConsumerListeners(socket.getSocket(), device.value as types.Device)

      /* if (resp.producers && resp.producers.length > 0) {
        console.debug('Starting to consume existing producers...')
        await startConsuming()
      } */
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
      console.groupEnd()
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
      console.groupEnd()
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

    if (env.VITE_DEBUG) {
      setInterval(async () => {
        if (!producerTransport.value) return
        console.groupCollapsed('RTC Statistics')
        const stats = await producerTransport.value.getStats()
        for (const report of stats.values()) {
          if (report.type === 'outbound-rtp') {
            console.group('outbound-rtp')
            console.debug(report)
            console.debug('bytesSent:', report.bytesSent)
            console.debug('packetsSent:', report.packetsSent)
            console.groupEnd()
          } else {
            console.debug(report)
          }
        }
        console.groupEnd()
      }, 1000)
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

  const requestTransportToConsume = async (
    recentSpeakersData: Array<{
      audioProducerId: string
      videoProducerId: string | null
      userName: string
      userId: string
    }>,
    socket: Socket,
    device: types.Device | null
  ) => {
    console.groupCollapsed('requestTransportToConsume')
    console.debug(recentSpeakersData)
    console.debug('socket :>> ', socket)
    console.debug('device :>> ', device)
    console.groupEnd()

    for (const [index, speaker] of recentSpeakersData.entries()) {
      try {
        console.log(`Creating consumer transport for ${speaker.userName}...`)

        const consumerTransportParams = await socket.emitWithAck('request-transport', {
          type: 'consumer',
          audioProducerId: speaker.audioProducerId,
        })

        if (!consumerTransportParams || typeof consumerTransportParams !== 'object') {
          console.error(`Invalid response type for ${speaker.userName}:`, consumerTransportParams)
          continue
        }

        if (!consumerTransportParams.success) {
          console.error(
            `Failed to create consumer transport for ${speaker.userName}:`,
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

        // TODO: the index here is only there to determine in what HTMLVideoElement the stream should go. maybe i find a way to do that based on the list of speakers
        /* const [audioConsumer, videoConsumer] = await Promise.all([
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

        console.groupCollapsed('recentSpeakersData')
        console.debug('audioConsumer :>> ', audioConsumer)
        console.debug('videoConsumer :>> ', videoConsumer)
        console.groupEnd()

        participants.value.set(speaker.userId, {
          userId: speaker.userId,
          userName: speaker.userName,
          audioTrack: audioConsumer?.track,
          videoTrack: videoConsumer?.track,
          audioConsumer: audioConsumer,
          videoConsumer: videoConsumer,
        }) */

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

        /* const tracks: MediaStreamTrack[] = []
        if (audioConsumer?.track) tracks.push(audioConsumer.track)
        if (videoConsumer?.track) tracks.push(videoConsumer.track) */
      } catch (error) {
        console.error(`Error setting up consumer for ${speaker.userName}:`, error)
      }
    }
  }

  const createConsumer = async (
    consumerTransport: types.Transport<types.AppData>,
    producerId: string | null,
    device: types.Device | null,
    socket: Socket,
    kind: types.MediaKind,
    index: number
  ): Promise<types.Consumer | undefined> => {
    const consumerParams = await socket.emitWithAck('consume-media', {
      rtpCapabilities: device?.rtpCapabilities,
      producerId,
      kind,
    })
    console.groupCollapsed('createConsumer')
    console.debug('consumerTransport :>> ', consumerTransport)
    console.debug('consumerParams :>> ', consumerParams)
    console.debug('index :>> ', index)
    console.groupEnd()

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
      console.debug('Transport connect event has fired')
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
        await requestTransportToConsume(data.recentSpeakersData, socket, device)
      }
    )

    socket.on('update-active-speakers', (activeSpeakerIds: string[]) => {
      console.log('Active speakers updated:', activeSpeakerIds)
      // TODO: update UI here to highlight active speakers
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
