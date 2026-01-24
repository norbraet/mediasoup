// conference/producerSignalingApi.ts
import type { Socket } from 'socket.io-client'
import type { ProducerSignalingApi } from '../types/types'

export function createProducerSignalingApi(socket: Socket): ProducerSignalingApi {
  return {
    async requestProducerTransport() {
      return socket.emitWithAck('request-transport', {
        type: 'producer',
      })
    },

    async connectProducerTransport(dtlsParameters) {
      const resp = await socket.emitWithAck('connect-transport', {
        dtlsParameters,
        type: 'producer',
      })

      if (!resp.success) {
        throw new Error(resp.error ?? 'connect-transport failed')
      }
    },

    async startProducing({ kind, rtpParameters, appData }) {
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
