import { types } from 'mediasoup'
import { ClientTransportParams } from './types'

export const createWebRtcTransport = async (
  router: types.Router
): Promise<{
  transport: types.WebRtcTransport
  clientTransportParams: ClientTransportParams
}> => {
  const transport = await router.createWebRtcTransport({
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
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }

  console.debug('clientTransportParams', clientTransportParams)

  return { transport, clientTransportParams }
}
