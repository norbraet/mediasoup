import { types } from 'mediasoup'

export type ClientProducingParams = Pick<
  types.ProducerOptions,
  'kind' | 'rtpParameters' | 'appData'
>

export type ClientTransportParams =
  | {
      id: string
      iceParameters: types.IceParameters
      iceCandidates: types.IceCandidate[]
      dtlsParameters: types.DtlsParameters
    }
  | { error: string }
