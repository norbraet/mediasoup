import type { types } from 'mediasoup-client'
import type { RoomParticipant, ConsumerSignalingApi } from '../../types/types'
import { ref, type Ref } from 'vue'
import type { RecentSpeakerData } from '@mediasoup/types'

export function useConsumer(
  consumerApi: ConsumerSignalingApi,
  participants: Ref<Map<string, RoomParticipant>>
) {
  const consumerTransports = ref<Map<string, types.Transport>>(new Map())

  const requestConsumerTransports = async (speakers: RecentSpeakerData[], device: types.Device) => {
    for (const speaker of speakers) {
      try {
        if (!speaker.audioProducerId && !speaker.videoProducerId) {
          participants.value.set(speaker.userId, {
            userId: speaker.userId,
            userName: speaker.userName,
            audioTrack: undefined,
            videoTrack: undefined,
            audioConsumer: undefined,
            videoConsumer: undefined,
            isVideoEnabled: false,
            isAudioMuted: false,
          })
          continue
        }

        const primaryProducerId = speaker.audioProducerId || speaker.videoProducerId!
        const transportResp = await consumerApi.requestConsumerTransport(primaryProducerId)
        const transport = createConsumerTransport(transportResp, primaryProducerId, device)
        consumerTransports.value.set(speaker.userId, transport)

        const [audioConsumer, videoConsumer] = await Promise.all([
          consume(transport, speaker.audioProducerId, device, 'audio'),
          consume(transport, speaker.videoProducerId, device, 'video'),
        ])

        participants.value.set(speaker.userId, {
          userId: speaker.userId,
          userName: speaker.userName,
          audioTrack: audioConsumer?.track,
          videoTrack: videoConsumer?.track,
          audioConsumer,
          videoConsumer,
          isVideoEnabled: !!videoConsumer,
          isAudioMuted: false,
        })
      } catch (err) {
        console.error(`Error setting up consumer for ${speaker.userName}:`, err)
      }
    }
  }

  const consume = async (
    transport: types.Transport,
    producerId: string | null,
    device: types.Device,
    kind: types.MediaKind
  ): Promise<types.Consumer | undefined> => {
    if (!producerId) return

    const consumerParams = await consumerApi.consumeMedia({
      rtpCapabilities: device.rtpCapabilities,
      producerId,
      kind,
    })

    if (!consumerParams.success || !consumerParams.params) {
      console.error('Failed to get consumer params:', consumerParams.error)
      return
    }

    const consumer = await transport.consume(consumerParams.params)
    await consumerApi.unpauseConsumer(producerId, kind)

    return consumer
  }

  const setupDynamicConsumerListeners = (device: types.Device) => {
    // TODO: TYPES new-producer-to-consume
    consumerApi.on(
      'new-producer-to-consume',
      async (data: {
        routerRtpCapabilities: types.RtpCapabilities
        recentSpeakersData: RecentSpeakerData[]
        activeSpeakerList: string[]
      }) => {
        console.log('New producers to consume:', data.recentSpeakersData)
        await requestConsumerTransports(data.recentSpeakersData, device)

        for (const speaker of data.recentSpeakersData) {
          const participant = participants.value.get(speaker.userId)
          if (participant) {
            participant.isVideoEnabled = !!speaker.videoProducerId
          }
        }
      }
    )

    // TODO: TYPES update-active-speakers
    consumerApi.on('update-active-speakers', (activeSpeakerIds: string[]) => {
      console.log('Active speakers updated:', activeSpeakerIds)
      for (const [userId, participant] of participants.value.entries()) {
        participant.isActiveSpeaker = activeSpeakerIds.includes(userId)
      }
    })

    // TODO: TYPES user-joined
    consumerApi.on('user-joined', (data: { userId: string; userName: string }) => {
      console.log('New user joined:', data.userName, data.userId)
      if (!participants.value.has(data.userId)) {
        participants.value.set(data.userId, {
          userId: data.userId,
          userName: data.userName,
          audioTrack: undefined,
          videoTrack: undefined,
          audioConsumer: undefined,
          videoConsumer: undefined,
          isVideoEnabled: false,
          isAudioMuted: false,
        })
      }
    })

    // TODO: TYPES user-left
    consumerApi.on('user-left', (data: { userId: string; userName: string }) => {
      console.log('User left:', data.userName, data.userId)
      const transport = consumerTransports.value.get(data.userId)
      if (transport) {
        transport.close()
        consumerTransports.value.delete(data.userId)
      }
      participants.value.delete(data.userId)
    })

    // TODO: TYPES participant-video-changed
    consumerApi.on(
      'participant-video-changed',
      (data: { userId: string; userName: string; isVideoEnabled: boolean }) => {
        console.log('Participant video changed:', data.userName, 'enabled:', data.isVideoEnabled)
        const participant = participants.value.get(data.userId)
        if (participant) {
          participant.isVideoEnabled = data.isVideoEnabled
        }
      }
    )

    // TODO: TYPES participant-audio-changed
    consumerApi.on(
      'participant-audio-changed',
      (data: { userId: string; userName: string; isAudioMuted: boolean }) => {
        console.log('Participant audio changed:', data.userName, 'muted:', data.isAudioMuted)
        const participant = participants.value.get(data.userId)
        if (participant) {
          participant.isAudioMuted = data.isAudioMuted
        }
      }
    )
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
    primaryProducerId: string,
    device: types.Device
  ) => {
    if (!device) throw new Error('No device found to create Consumer Transport')

    const consumerTransport = device.createRecvTransport(consumerTransportParams.params)

    consumerTransport.on('connectionstatechange', (state) => {
      console.debug('Consumer transport connection state:', state)
    })

    consumerTransport.on('icegatheringstatechange', (state) => {
      console.debug('Consumer transport ICE gathering state:', state)
    })

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await consumerApi.connectConsumerTransport(dtlsParameters, primaryProducerId)
        callback()
      } catch (error) {
        console.error('Error connecting consumer transport:', error)
        errback(error as Error)
      }
    })

    return consumerTransport
  }

  return {
    requestConsumerTransports,
    setupDynamicConsumerListeners,
    consumerTransports,
  }
}
