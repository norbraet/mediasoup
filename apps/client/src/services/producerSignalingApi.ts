// conference/producerSignalingApi.ts
import type { Socket } from 'socket.io-client'
import type { ProducerSignalingApi } from '../types/types'
import { Role, SOCKET_EVENTS, type ConnectTransportResponse } from '@mediasoup/types'

export function createProducerSignalingApi(socket: Socket): ProducerSignalingApi {
  return {
    async requestProducerTransport() {
      // TODO: TYPES request-transport
      return socket.emitWithAck(SOCKET_EVENTS.REQUEST_TRANSPORT, {
        type: Role.Producer,
      })
    },

    async connectProducerTransport(dtlsParameters) {
      // TODO: TYPES connect-transport
      const resp: ConnectTransportResponse = await socket.emitWithAck(
        SOCKET_EVENTS.CONNECT_TRANSPORT,
        {
          dtlsParameters,
          type: Role.Producer,
        }
      )

      if (!resp.success) {
        throw new Error(resp.error ?? `${SOCKET_EVENTS.CONNECT_TRANSPORT} failed`)
      }
    },

    async startProducing({ kind, rtpParameters, appData }) {
      // TODO: TYPES start-producing
      const resp = await socket.emitWithAck(SOCKET_EVENTS.START_PRODUCING, {
        kind,
        rtpParameters,
        appData,
      })

      if (!resp.success) {
        throw new Error(resp.error ?? `${SOCKET_EVENTS.START_PRODUCING} failed`)
      }

      return { id: resp.id }
    },
  }
}
