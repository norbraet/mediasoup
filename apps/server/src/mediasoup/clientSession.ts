import { types } from 'mediasoup'

export interface ClientSession {
  setProducerTransport(transport: types.WebRtcTransport): void
  getProducerTransport(): types.WebRtcTransport | null
  setConsumerTransport(transport: types.WebRtcTransport): void
  getConsumerTransport(): types.WebRtcTransport | null
  setProducer(producer: types.Producer): void
  getProducer(): types.Producer | null
  setConsumer(consumer: types.Consumer): void
  getConsumer(): types.Consumer | null
  cleanup(): void
}

export function createClientSession(): ClientSession {
  let producerTransport: types.WebRtcTransport | null = null
  let consumerTransport: types.WebRtcTransport | null = null
  let producer: types.Producer | null = null
  let consumer: types.Consumer | null = null

  return {
    setProducerTransport: (transport): void => {
      producerTransport = transport
    },
    getProducerTransport: () => producerTransport,

    setConsumerTransport: (transport): void => {
      consumerTransport = transport
    },
    getConsumerTransport: () => consumerTransport,

    setProducer: (p): void => {
      producer = p
    },
    getProducer: () => producer,

    setConsumer: (c): void => {
      consumer = c
    },
    getConsumer: () => consumer,

    cleanup: (): void => {
      producerTransport?.close()
      consumerTransport?.close()
      producer = null
      consumer = null
    },
  }
}
