import type { Socket } from 'socket.io-client'
import { types } from 'mediasoup-client'
import type { ConsumerSignalingApi } from '../types/types'
import {
  Role,
  SOCKET_EVENTS,
  type ConnectTransportData,
  type ConnectTransportResponse,
  type ConsumeMediaData,
  type ConsumeMediaResponse,
  type RequestTransportData,
  type RequestTransportResponse,
} from '@mediasoup/types'

export function createConsumerSignalingApi(socket: Socket): ConsumerSignalingApi {
  return {
    async requestConsumerTransport(audioProducerId: string) {
      // TODO: TYPES request-transport
      const payload: RequestTransportData = { type: Role.Consumer, audioProducerId }
      const resp: RequestTransportResponse = await socket.emitWithAck(
        SOCKET_EVENTS.REQUEST_TRANSPORT,
        payload
      )
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
      // TODO: TYPES consume-media
      const resp: ConsumeMediaResponse = await socket.emitWithAck(
        SOCKET_EVENTS.CONSUME_MEDIA,
        params satisfies ConsumeMediaData
      )
      return resp
    },

    async unpauseConsumer(producerId: string, kind: string) {
      // TODO: TYPES unpause-consumer
      return socket.emitWithAck(SOCKET_EVENTS.UNPAUSE_CONSUMER, { producerId, kind })
    },

    async connectConsumerTransport(dtlsParameters: types.DtlsParameters, audioProducerId: string) {
      // TODO: TYPES connect-transport
      const payload: ConnectTransportData = { dtlsParameters, type: Role.Consumer, audioProducerId }
      const resp: ConnectTransportResponse = await socket.emitWithAck(
        SOCKET_EVENTS.CONNECT_TRANSPORT,
        payload
      )
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to connect consumer transport')
      }
      return resp
    },

    updateActiveSpeakers(activeSpeakerIds: string[]) {
      // TODO: TYPES update-active-speakers
      socket.emit('update-active-speakers', activeSpeakerIds)
    },

    participantVideoChanged(userId: string, isVideoEnabled: boolean) {
      // TODO: TYPES participant-video-changed
      socket.emit('participant-video-changed', { userId, isVideoEnabled })
    },

    participantAudioChanged(userId: string, isAudioMuted: boolean) {
      // TODO: TYPES participant-audio-changed
      socket.emit('participant-audio-changed', { userId, isAudioMuted })
    },

    userJoined(userId: string, userName: string) {
      // TODO: TYPES user-joined
      socket.emit('user-joined', { userId, userName })
    },

    userLeft(userId: string, userName: string) {
      // TODO: TYPES user-left
      socket.emit('user-left', { userId, userName })
    },

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
