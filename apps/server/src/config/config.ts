import { types } from 'mediasoup'
import env from './env'

type MediasoupConfigType = {
  workersAmount: number
  worker: types.WorkerSettings
  router: {
    mediaCodecs: types.RouterRtpCodecCapability[]
  }
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
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {},
      },
    ],
  },
}
