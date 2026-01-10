import { types } from 'mediasoup'
import { initMediasoup } from '../mediasoup/createMediasoup'
import { createWebRtcTransport } from '../mediasoup/createWebRtcTransport'
import { createProducerManager, type ProducerManager } from './producerManager'
import { ClientTransportParams } from '../mediasoup/types'

export interface MediasoupService {
  getRouterRtpCapabilities(): types.RtpCapabilities
  createWebRtcTransport(): Promise<{
    transport: types.WebRtcTransport
    clientTransportParams: ClientTransportParams
  }>
  addProducer(producer: types.Producer): void
  getCurrentProducer(): types.Producer | null
  canConsume(producerId: string, rtpCapabilities: types.RtpCapabilities): boolean
}

export async function createMediasoupService(): Promise<MediasoupService> {
  const router = await initMediasoup()
  const producerManager: ProducerManager = createProducerManager()

  return {
    getRouterRtpCapabilities: () => router.rtpCapabilities,

    createWebRtcTransport: () => createWebRtcTransport(router),

    addProducer: (producer: types.Producer): void => {
      producerManager.addProducer(producer)
    },

    getCurrentProducer: () => producerManager.getCurrentProducer(),

    canConsume: (producerId: string, rtpCapabilities: types.RtpCapabilities) =>
      router.canConsume({ producerId, rtpCapabilities }),
  }
}
