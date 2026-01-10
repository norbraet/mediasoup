import { Socket } from 'socket.io'
import { types } from 'mediasoup'
import type { MediasoupService } from '../../services/mediasoupService'
import { createClientSession, type ClientSession } from '../../mediasoup/clientSession'
import type { ClientProducingParams, ClientTransportParams } from '../../types.ts'

interface WebRTCHandlers {
  getRtpCap: ReturnType<typeof handleGetRtpCapabilities>
  'create-producer-transport': ReturnType<typeof handleCreateProducerTransport>
  'create-consumer-transport': ReturnType<typeof handleCreateConsumerTransport>
  'connect-transport': ReturnType<typeof handleConnectTransport>
  'connect-consumer-transport': ReturnType<typeof handleConnectTransport>
  'start-producing': ReturnType<typeof handleStartProducing>
  'consume-media': ReturnType<typeof handleConsumeMedia>
  'unpause-consumer': ReturnType<typeof handleUnpauseConsumer>
  'close-all': ReturnType<typeof handleCloseAll>
  disconnect: () => void
}

export function createWebRTCHandlers(
  socket: Socket,
  mediasoupService: MediasoupService
): WebRTCHandlers {
  const session = createClientSession()

  return {
    getRtpCap: handleGetRtpCapabilities(mediasoupService),
    'create-producer-transport': handleCreateProducerTransport(mediasoupService, session),
    'create-consumer-transport': handleCreateConsumerTransport(mediasoupService, session),
    'connect-transport': handleConnectTransport(session, 'producer'),
    'connect-consumer-transport': handleConnectTransport(session, 'consumer'),
    'start-producing': handleStartProducing(mediasoupService, session),
    'consume-media': handleConsumeMedia(mediasoupService, session),
    'unpause-consumer': handleUnpauseConsumer(session),
    'close-all': handleCloseAll(session),
    disconnect: (): void => session.cleanup(),
  }
}

const handleGetRtpCapabilities =
  (mediasoupService: MediasoupService) =>
  (acknowledgement: (rtpCapabilities: types.RtpCapabilities) => void): void => {
    acknowledgement(mediasoupService.getRouterRtpCapabilities())
  }

const handleCreateProducerTransport =
  (mediasoupService: MediasoupService, session: ClientSession) =>
  async (acknowledgement: (params: ClientTransportParams) => void): Promise<void> => {
    try {
      const { transport, clientTransportParams } = await mediasoupService.createWebRtcTransport()
      session.setProducerTransport(transport)
      acknowledgement(clientTransportParams)
    } catch (error) {
      console.error('Error creating producer transport:', error)
      acknowledgement({ error: 'Failed to create transport' })
    }
  }

const handleCreateConsumerTransport =
  (mediasoupService: MediasoupService, session: ClientSession) =>
  async (acknowledgement: (params: ClientTransportParams) => void): Promise<void> => {
    try {
      const { transport, clientTransportParams } = await mediasoupService.createWebRtcTransport()
      session.setConsumerTransport(transport)
      acknowledgement(clientTransportParams)
    } catch (error) {
      console.error('Error creating consumer transport:', error)
      acknowledgement({ error: 'Failed to create transport' })
    }
  }

const handleConnectTransport =
  (session: ClientSession, type: 'producer' | 'consumer') =>
  async (
    data: { dtlsParameters: types.DtlsParameters },
    acknowledgement: (message: string) => void
  ): Promise<void> => {
    try {
      const transport =
        type === 'producer' ? session.getProducerTransport() : session.getConsumerTransport()

      if (transport) {
        await transport.connect({ dtlsParameters: data.dtlsParameters })
        acknowledgement('success')
      } else {
        acknowledgement('no-transport')
      }
    } catch (error) {
      console.error(`connect-${type}-transport`, error)
      acknowledgement('error')
    }
  }

const handleStartProducing =
  (mediasoupService: MediasoupService, session: ClientSession) =>
  async (
    parameters: ClientProducingParams,
    acknowledgement: (message: string) => void
  ): Promise<void> => {
    try {
      const transport = session.getProducerTransport()
      if (!transport) throw new Error('No Client Producer Transport')

      const producer = await transport.produce(parameters)
      session.setProducer(producer)
      mediasoupService.addProducer(producer)

      acknowledgement(producer.id)
    } catch (error) {
      console.error('start-producing', error)
      acknowledgement('error')
    }
  }

const handleConsumeMedia =
  (mediasoupService: MediasoupService, session: ClientSession) =>
  async (
    data: { rtpCapabilities: types.RtpCapabilities },
    acknowledgement: Function
  ): Promise<void> => {
    const { rtpCapabilities } = data

    try {
      const currentProducer = mediasoupService.getCurrentProducer()

      if (!currentProducer) {
        acknowledgement('noProducer')
        return
      }

      if (!mediasoupService.canConsume(currentProducer.id, rtpCapabilities)) {
        acknowledgement('cannotConsume')
        return
      }

      const consumerTransport = session.getConsumerTransport()
      if (!consumerTransport) {
        acknowledgement('noTransport')
        return
      }

      const consumer = await consumerTransport.consume({
        producerId: currentProducer.id,
        rtpCapabilities,
        paused: true,
      })

      session.setConsumer(consumer)

      const consumerParams = {
        producerId: currentProducer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      }

      acknowledgement(consumerParams)
    } catch (error) {
      console.error('consume-media error:', error)
      acknowledgement('error')
    }
  }

const handleUnpauseConsumer =
  (session: ClientSession) =>
  async (_acknowledgement: Function): Promise<void> => {
    const consumer = session.getConsumer()
    if (consumer) {
      await consumer.resume()
    }
  }

const handleCloseAll =
  (session: ClientSession) =>
  (acknowledgement: (message: string) => void): void => {
    try {
      session.cleanup()
      acknowledgement('closed')
    } catch (error) {
      console.log(error)
      acknowledgement('closeError')
    }
  }
