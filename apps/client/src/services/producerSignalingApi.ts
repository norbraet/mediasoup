import type { Socket } from 'socket.io-client'
import type { ProducerSignalingApi } from '../types/types'
import {
  Role,
  SOCKET_EVENTS,
  type ConnectTransportData,
  type ConnectTransportResponse,
  type RequestTransportData,
  type StartProducingData,
} from '@mediasoup/types'

export function createProducerSignalingApi(socket: Socket): ProducerSignalingApi {
  return {
    async requestProducerTransport() {
      // TODO: TYPES request-transport
      const payload: RequestTransportData = { type: Role.Producer }
      return socket.emitWithAck(SOCKET_EVENTS.REQUEST_TRANSPORT, payload)
    },

    async connectProducerTransport(dtlsParameters) {
      // TODO: TYPES connect-transport
      const payload: ConnectTransportData = { dtlsParameters, type: Role.Producer }
      const resp: ConnectTransportResponse = await socket.emitWithAck(
        SOCKET_EVENTS.CONNECT_TRANSPORT,
        payload
      )

      if (!resp.success) {
        throw new Error(resp.error ?? `${SOCKET_EVENTS.CONNECT_TRANSPORT} failed`)
      }
    },

    async startProducing({ kind, rtpParameters, appData }) {
      // TODO: TYPES start-producing
      const payload: StartProducingData = {
        kind,
        rtpParameters,
        appData,
      }
      const resp = await socket.emitWithAck(SOCKET_EVENTS.START_PRODUCING, payload)

      if (!resp.success) {
        throw new Error(resp.error ?? `${SOCKET_EVENTS.START_PRODUCING} failed`)
      }

      return { id: resp.id }
    },
  }
}
