import { Socket } from 'socket.io'
import { types } from 'mediasoup'
import type { MediasoupService } from '../../types'
import { createClientSession, type ClientSession } from '../../mediasoup/clientSession'
import type { ClientProducingParams, ClientTransportParams } from '../../types.ts'
import { RoleType, SOCKET_EVENTS } from '@mediasoup/types'

interface WebRTCHandlers {
  getRtpCap: ReturnType<typeof handleGetRtpCapabilities>
  'create-producer-transport': ReturnType<typeof handleCreateProducerTransport>
  'create-consumer-transport': ReturnType<typeof handleCreateConsumerTransport>
  [SOCKET_EVENTS.CONNECT_TRANSPORT]: ReturnType<typeof handleConnectTransport>
  'connect-consumer-transport': ReturnType<typeof handleConnectTransport>
  [SOCKET_EVENTS.START_PRODUCING]: ReturnType<typeof handleStartProducing>
  [SOCKET_EVENTS.CONSUME_MEDIA]: ReturnType<typeof handleConsumeMedia>
  [SOCKET_EVENTS.UNPAUSE_CONSUMER]: ReturnType<typeof handleUnpauseConsumer>
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
    [SOCKET_EVENTS.CONNECT_TRANSPORT]: handleConnectTransport(session, 'producer'),
    'connect-consumer-transport': handleConnectTransport(session, 'consumer'),
    [SOCKET_EVENTS.START_PRODUCING]: handleStartProducing(mediasoupService, session),
    [SOCKET_EVENTS.CONSUME_MEDIA]: handleConsumeMedia(mediasoupService, session),
    [SOCKET_EVENTS.UNPAUSE_CONSUMER]: handleUnpauseConsumer(session),
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

// TODO: TYPES connect-transport
const handleConnectTransport =
  (session: ClientSession, type: RoleType) =>
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

// TODO: TYPES connect-transport
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
      console.error(SOCKET_EVENTS.START_PRODUCING, error)
      acknowledgement('error')
    }
  }

// TODO: TYPES consume-media
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
      console.error(SOCKET_EVENTS.CONSUME_MEDIA, ' error:', error)
      acknowledgement('error')
    }
  }

// TODO: TYPES unpause-consumer
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
