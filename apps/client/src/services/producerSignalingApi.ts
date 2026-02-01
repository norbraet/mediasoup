// conference/producerSignalingApi.ts
import type { Socket } from 'socket.io-client'
import type { ProducerSignalingApi } from '../types/types'
import { Role, type ConnectTransportResponse } from '@mediasoup/types'

export function createProducerSignalingApi(socket: Socket): ProducerSignalingApi {
  return {
    async requestProducerTransport() {
      // TODO: TYPES request-transport
      return socket.emitWithAck('request-transport', {
        type: Role.Producer,
      })
    },

    async connectProducerTransport(dtlsParameters) {
      // TODO: TYPES connect-transport
      const resp: ConnectTransportResponse = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: Role.Producer,
      })

      if (!resp.success) {
        throw new Error(resp.error ?? 'connect-transport failed')
      }
    },

    async startProducing({ kind, rtpParameters, appData }) {
      // TODO: TYPES start-producing
      const resp = await socket.emitWithAck('start-producing', {
        kind,
        rtpParameters,
        appData,
      })

      if (!resp.success) {
        throw new Error(resp.error ?? 'start-producing failed')
      }

      return { id: resp.id }
    },
  }
}
