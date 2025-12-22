import { types } from 'mediasoup'

export type ClientTransportParams = {
  id: string
  iceParameters: types.IceParameters
  iceCandidates: types.IceCandidate[]
  dtlsParameters: types.DtlsParameters
}
