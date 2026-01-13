import { types } from 'mediasoup'
import { ClientTransportParams } from '../types'
import env from '../config/env'

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
    listenIps: [
      { ip: '0.0.0.0', announcedIp: env.LOCAL_IP },
      { ip: '127.0.0.1', announcedIp: undefined },
    ],
    initialAvailableOutgoingBitrate: env.MEDIASOUP_OUTGOING_BITRATE,
  })
  await transport.setMaxIncomingBitrate(env.MEDIASOUP_INCOMING_BITRATE)

  const clientTransportParams: ClientTransportParams = {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }

  return { transport, clientTransportParams }
}
