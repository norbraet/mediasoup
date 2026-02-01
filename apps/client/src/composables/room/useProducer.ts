import { ref, type Ref } from 'vue'
import type { Device, types } from 'mediasoup-client'
import type { ProducerSignalingApi, ProducerSocketApi } from '../../types/types'

export function useProducer(
  signalingApi: ProducerSignalingApi,
  eventApi: ProducerSocketApi,
  mediaState: {
    isAudioMuted: Ref<boolean>
    isVideoEnabled: Ref<boolean>
    toggleAudioTrack: () => void
    toggleVideoTrack: () => void
  }
) {
  const producerTransport = ref<types.Transport | null>(null)
  const videoProducer = ref<types.Producer | null>(null)
  const audioProducer = ref<types.Producer | null>(null)
  const screenProducer = ref<types.Producer | null>(null)

  const requestProducerTransport = async (device: Device) => {
    console.debug('Requesting producer transport...')
    const producerTransportParams = await signalingApi.requestProducerTransport()
    console.debug('Producer transport params:', producerTransportParams)

    if (!device) {
      console.error('Missing device!')
      return
    }

    if (!producerTransportParams.success) {
      throw new Error(producerTransportParams.error || 'Failed to request producer transport')
    }

    if (!producerTransportParams.params) {
      console.debug('Producer transport already exists on server, skipping client setup')
      return
    }

    const transport = device.createSendTransport(producerTransportParams.params)
    producerTransport.value = transport

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await signalingApi.connectProducerTransport(dtlsParameters)
        callback()
      } catch (err) {
        errback(err as Error)
      }
    })

    transport.on('produce', async (parameters, callback, errback) => {
      try {
        const { id } = await signalingApi.startProducing(parameters)
        callback({ id })
      } catch (err) {
        errback(err as Error)
      }
    })
  }

  const startProducing = async (stream: MediaStream) => {
    if (!stream) return
    if (!producerTransport.value) {
      throw new Error('Producer transport not available. Call requestProducerTransport first.')
    }

    try {
      await createProducer(stream, producerTransport.value as types.Transport<types.AppData>)
    } catch (error) {
      console.error('Failed to start producing:', error)
    }
  }

  const startScreenShare = async (stream: MediaStream) => {
    if (!producerTransport.value) throw new Error('Producer transport not ready')
    if (screenProducer.value) return

    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) throw new Error('No video track in screen stream')
    console.log('Producing screen share track ...')

    const producer = await producerTransport.value.produce({ track: videoTrack })
    screenProducer.value = producer

    videoTrack.addEventListener('ended', () => {
      console.log('Screen share track ended (browser UI)')
      stopScreenShare()
    })

    producer.on('transportclose', () => {
      console.log('Screen producer transport closed')
      screenProducer.value = null
    })

    producer.on('@close', () => {
      console.log('Screen producer closed')
      screenProducer.value = null
    })
  }

  const stopScreenShare = () => {
    if (!screenProducer.value) return

    console.log('Stopping screen share producer')
    try {
      const track = screenProducer.value.track
      screenProducer.value.close()
      track?.stop()
    } catch (err) {
      console.warn('Error stopping screen share:', err)
    } finally {
      screenProducer.value = null
    }
  }

  const toggleAudio = (): void => {
    if (audioProducer.value) {
      try {
        if (mediaState.isAudioMuted.value) {
          audioProducer.value.resume()
          mediaState.isAudioMuted.value = false
        } else {
          audioProducer.value.pause()
          mediaState.isAudioMuted.value = true
        }

        eventApi.emitAudioMuted(mediaState.isAudioMuted.value)
      } catch (error) {
        console.error('Failed to toggle audio producer. Fallback to local track:', error)
        mediaState.toggleAudioTrack()
      }
    } else {
      // No producer yet, just toggle local track
      mediaState.toggleAudioTrack()
    }
  }

  const toggleVideo = (): void => {
    if (videoProducer.value) {
      try {
        const videoTrack = videoProducer.value.track
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled
          mediaState.isVideoEnabled.value = videoTrack.enabled

          if (videoTrack.enabled) {
            videoProducer.value.resume()
          } else {
            videoProducer.value.pause()
          }

          eventApi.emitVideoEnabled(mediaState.isVideoEnabled.value)
        }
      } catch (error) {
        console.error('Failed to toggle video producer. Fallback to local track:', error)
        mediaState.toggleVideoTrack()
      }
    } else {
      // No producer yet, just toggle local track
      mediaState.toggleVideoTrack()
    }
  }

  const createProducer = async (
    localStream: MediaStream,
    producerTransport: types.Transport<types.AppData>
  ): Promise<void> => {
    const videoTrack = localStream.getVideoTracks()[0]
    const audioTrack = localStream.getAudioTracks()[0]

    try {
      if (videoTrack && !videoProducer.value) {
        console.log('Creating video producer...')
        videoProducer.value = await producerTransport.produce({ track: videoTrack })
      }
      if (audioTrack && !audioProducer.value) {
        console.log('Creating audio producer...')
        audioProducer.value = await producerTransport.produce({ track: audioTrack })

        // Sync producer state with local ref state
        audioProducer.value.on('@pause', () => {
          mediaState.isAudioMuted.value = true
        })

        audioProducer.value.on('@resume', () => {
          mediaState.isAudioMuted.value = false
        })
      }
    } catch (error) {
      console.error('Error producing:', error)
    }
  }

  const resetProducer = () => {
    producerTransport.value = null
    videoProducer.value = null
    audioProducer.value = null
  }

  return {
    producerTransport,
    videoProducer,
    audioProducer,
    requestProducerTransport,
    startProducing,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
    resetProducer,
  }
}
