import { types } from 'mediasoup'
import env from './env'

type MediasoupConfigType = {
  workersAmount: number
  worker: types.WorkerSettings
}

export const mediasoupConfig: MediasoupConfigType = {
  workersAmount: env.MEDIASOUP_WORKERS_AMOUNT,
  worker: {
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      //   'rtx',
      //   'bwe',
      //   'score',
      //   'simulcast',
      //   'svc',
    ],
    rtcMinPort: env.MEDIASOUP_WORKER_RTC_MIN_PORT,
    rtcMaxPort: env.MEDIASOUP_WORKER_RTC_MAX_PORT,
  },
}
