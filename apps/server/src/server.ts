import fs from 'fs'
import { createServer } from 'https'
import { createApp } from './express/app'
import { initMediasoup } from './mediasoup/createMediasoup'
import env from './config/env'
import { Server as SocketIOServer } from 'socket.io'
import { types } from 'mediasoup'

type ClientTransportParams = {
  id: string
  iceParameters: types.IceParameters
  iceCandidates: types.IceCandidate[]
  dtlsParameters: types.DtlsParameters
}

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

  const httpsServer = createServer(options, app).listen(env.EXPRESS_PORT)
  const io = new SocketIOServer(httpsServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  console.debug('Server is running on port:', env.EXPRESS_PORT)

  const router = await initMediasoup()

  io.on('connect', (socket) => {
    let thisClientProducerTransport: types.WebRtcTransport | null = null
    let thisClientProducer: types.Producer | null = null

    socket.on('getRtpCap', (acknowledgement: (rtpCapabilities: types.RtpCapabilities) => void) => {
      acknowledgement(router.rtpCapabilities)
    })

    socket.on(
      'create-producer-transport',
      async (acknowledgement: (params: ClientTransportParams) => void) => {
        thisClientProducerTransport = await router.createWebRtcTransport({
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          listenInfos: [
            {
              protocol: 'udp',
              ip: '127.0.0.1',
            },
            {
              protocol: 'tcp',
              ip: '127.0.0.1',
            },
          ],
        })
        const clientTransportParams: ClientTransportParams = {
          id: thisClientProducerTransport.id,
          iceParameters: thisClientProducerTransport.iceParameters,
          iceCandidates: thisClientProducerTransport.iceCandidates,
          dtlsParameters: thisClientProducerTransport.dtlsParameters,
        }

        console.debug('clientTransportParams', clientTransportParams)
        acknowledgement(clientTransportParams)
      }
    )

    /** Gets the DTLS Info from the client, and finish the connection.
     * On Success, sends the string success. On Error, sends the string error
     */
    socket.on(
      'connect-transport',
      async (dtlsParameters: types.DtlsParameters, acknowledgment: (message: string) => void) => {
        // TODO: The message should be an own shared type so the client knows what to expect back
        try {
          if (thisClientProducerTransport) {
            await thisClientProducerTransport?.connect({ dtlsParameters })
            acknowledgment('success')
          }
        } catch (error) {
          console.error('connect-transport', error)
          acknowledgment('error')
        }
      }
    )

    socket.on(
      'start-producing',
      async (parameters: ClientProducingParams, acknowledgment: (message: string) => void) => {
        try {
          if (!thisClientProducerTransport) throw new Error('No Client Producer Transport')

          thisClientProducer = await thisClientProducerTransport.produce(parameters)
          // TODO: The message should be an own shared type so the client knows what to expect back
          acknowledgment(thisClientProducer.id)
        } catch (error) {
          console.error('start-producing', error)
          acknowledgment('error')
        }
      }
    )
  })
}

try {
  main()
} catch (error) {
  console.error('Fatal server error:', error)
}
