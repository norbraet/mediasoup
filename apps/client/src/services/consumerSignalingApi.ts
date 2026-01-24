import type { Socket } from 'socket.io-client'
import { types } from 'mediasoup-client'
import type { ConsumerSignalingApi } from '../types/types'

export function createConsumerSignalingApi(socket: Socket): ConsumerSignalingApi {
  return {
    async requestConsumerTransport(audioProducerId: string) {
      const resp = await socket.emitWithAck('request-transport', {
        type: 'consumer',
        audioProducerId,
      })
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to request consumer transport')
      }
      return resp
    },

    async consumeMedia(params: {
      rtpCapabilities: types.RtpCapabilities
      producerId: string
      kind: string
    }) {
      const resp = await socket.emitWithAck('consume-media', params)
      return resp
    },

    async unpauseConsumer(producerId: string, kind: string) {
      return socket.emitWithAck('unpause-consumer', { producerId, kind })
    },

    async connectConsumerTransport(dtlsParameters: types.DtlsParameters, audioProducerId: string) {
      const resp = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: 'consumer',
        audioProducerId,
      })
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to connect consumer transport')
      }
      return resp
    },

    updateActiveSpeakers(activeSpeakerIds: string[]) {
      socket.emit('update-active-speakers', activeSpeakerIds)
    },

    participantVideoChanged(userId: string, isVideoEnabled: boolean) {
      socket.emit('participant-video-changed', { userId, isVideoEnabled })
    },

    participantAudioChanged(userId: string, isAudioMuted: boolean) {
      socket.emit('participant-audio-changed', { userId, isAudioMuted })
    },

    userJoined(userId: string, userName: string) {
      socket.emit('user-joined', { userId, userName })
    },

    userLeft(userId: string, userName: string) {
      socket.emit('user-left', { userId, userName })
    },

    // Helper to subscribe to server events from the composable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void) {
      socket.on(event, listener)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(event: string, listener?: (...args: any[]) => void) {
      socket.off(event, listener)
    },
  }
}
