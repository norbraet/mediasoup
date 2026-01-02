import fs from 'fs'
import { createServer } from 'https'
import { createApp } from './express/app'
import { initMediasoup } from './mediasoup/createMediasoup'
import env from './config/env'
import { Server as SocketIOServer } from 'socket.io'
import { types } from 'mediasoup'
import { createWebRtcTransport } from './mediasoup/createWebRtcTransport'
import { ClientTransportParams } from './mediasoup/types'

type ClientProducingParams = Pick<types.ProducerOptions, 'kind' | 'rtpParameters' | 'appData'>

async function main(): Promise<void> {
  const app = createApp()

  // Keys were made with mkcert
  const key = fs.readFileSync('./create-cert-key.pem')
  const cert = fs.readFileSync('./create-cert.pem')
  const options = {
    key: key,
    cert: cert,
  }

  const httpsServer = createServer(options, app).listen(env.EXPRESS_PORT, () => {
    const link = (url: string): string => `\x1b[36m${url}\x1b[0m`

    console.debug('🚀 Conference Server Started!')
    console.debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.debug('🔌 Server port:', env.EXPRESS_PORT)
    console.debug(`📡 Server URL:   ${link(env.SERVER_URL)}`)
    console.debug(`🌐 Network Access:`)
    env.ALL_IPS.forEach((ip) => {
      if (ip !== 'localhost' && ip !== '127.0.0.1') {
        console.debug(`                 ${link(`https://${ip}:${env.EXPRESS_PORT}`)}`)
      }
    })
    console.debug(`💻 Local Access: ${link(`https://localhost:${env.EXPRESS_PORT}`)}`)
  })

  const io = new SocketIOServer(httpsServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST'],
    },
  })
  let thisProducer: types.Producer | null = null // The producer will be a global and whoever produced last

  const router = await initMediasoup()

  io.on('connect', (socket) => {
    let thisClientProducerTransport: types.WebRtcTransport | null = null
    let thisClientProducer: types.Producer | null = null
    let thisClientConsumerTransport: types.WebRtcTransport | null = null
    let thisClientConsumer: types.Consumer | null = null

    socket.on('getRtpCap', (acknowledgement: (rtpCapabilities: types.RtpCapabilities) => void) => {
      acknowledgement(router.rtpCapabilities)
    })

    socket.on(
      'create-producer-transport',
      async (acknowledgement: (params: ClientTransportParams) => void) => {
        const { transport, clientTransportParams } = await createWebRtcTransport(router)
        thisClientProducerTransport = transport
        acknowledgement(clientTransportParams)
      }
    )

    socket.on(
      'create-consumer-transport',
      async (acknowledgement: (params: ClientTransportParams) => void) => {
        const { transport, clientTransportParams } = await createWebRtcTransport(router)
        thisClientConsumerTransport = transport
        acknowledgement(clientTransportParams)
      }
    )

    /** Gets the DTLS Info from the client, and finish the connection.
     * On Success, sends the string success. On Error, sends the string error
     */
    socket.on(
      'connect-transport',
      async (
        data: { dtlsParameters: types.DtlsParameters },
        acknowledgement: (message: string) => void
      ) => {
        // TODO: The message should be an own shared type so the client knows what to expect back
        try {
          if (thisClientProducerTransport) {
            await thisClientProducerTransport.connect({ dtlsParameters: data.dtlsParameters })
            acknowledgement('success')
          }
        } catch (error) {
          console.error('connect-transport', error)
          acknowledgement('error')
        }
      }
    )

    // TODO: connect-consumer-transport and connect-transport is exactly the same logic.
    //  Refactor it so it accepts another parameter that can determine which transport to connect with
    socket.on(
      'connect-consumer-transport',
      async (
        data: { dtlsParameters: types.DtlsParameters },
        acknowledgement: (message: string) => void
      ) => {
        // TODO: The message should be an own shared type so the client knows what to expect back
        try {
          if (thisClientConsumerTransport) {
            await thisClientConsumerTransport.connect({ dtlsParameters: data.dtlsParameters })
            acknowledgement('success')
          }
        } catch (error) {
          console.error('connect-transport', error)
          acknowledgement('error')
        }
      }
    )

    socket.on(
      'start-producing',
      async (parameters: ClientProducingParams, acknowledgement: (message: string) => void) => {
        try {
          if (!thisClientProducerTransport) throw new Error('No Client Producer Transport')

          thisClientProducer = await thisClientProducerTransport.produce(parameters)
          thisProducer = thisClientProducer

          // TODO: The message should be an own shared type so the client knows what to expect back
          acknowledgement(thisClientProducer.id)
        } catch (error) {
          console.error('start-producing', error)
          acknowledgement('error')
        }
      }
    )

    socket.on(
      'consume-media',
      async (data: { rtpCapabilities: types.RtpCapabilities }, acknowledgement) => {
        const { rtpCapabilities } = data

        try {
          if (!thisProducer) {
            // TODO: Create a shared type for the options that can be send back to the client and use
            // the type on the client and on the server
            acknowledgement('noProducer')
          } else if (!router.canConsume({ producerId: thisProducer.id, rtpCapabilities })) {
            // TODO: Same here as stated aboce
            acknowledgement('cannotConsume')
          } else {
            if (thisClientConsumerTransport === null) {
              acknowledgement('noTransport')
              return
            }

            thisClientConsumer = await thisClientConsumerTransport.consume({
              producerId: thisProducer.id,
              rtpCapabilities,
              paused: true,
            })

            const consumerParams = {
              producerId: thisProducer.id,
              id: thisClientConsumer.id,
              kind: thisClientConsumer.kind,
              rtpParameters: thisClientConsumer.rtpParameters,
            }

            acknowledgement(consumerParams)
          }
        } catch (error) {
          console.error('consume-media error:', error)
          acknowledgement('error')
        }
      }
    )

    socket.on('unpause-consumer', async (_acknowledgement) => {
      if (thisClientConsumer === null) return
      await thisClientConsumer.resume()
    })

    socket.on('close-all', (acknowledgement: (message: string) => void) => {
      try {
        thisClientConsumerTransport?.close()
        thisClientProducerTransport?.close()
        acknowledgement('closed')
      } catch (error) {
        console.log(error)
        acknowledgement('closeError')
      }
    })
  })
}

try {
  main()
} catch (error) {
  console.error('Fatal server error:', error)
}
