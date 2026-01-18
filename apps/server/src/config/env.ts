import dotenv from 'dotenv'
import { z } from 'zod'
import { getLocalIP, getAllNetworkIPs } from '../utils/networkUtils'

dotenv.config()

const envSchema = z
  .object({
    EXPRESS_PORT: z.coerce
      .number()
      .min(1000, { error: 'EXPRESS_PORT must be at least 1000 and 4 digit long' }),
    CLIENT_PORT: z.coerce
      .number()
      .min(1000, { error: 'CLIENT_PORT must be at least 1000 and 4 digit long' }),
    ENVIRONMENT: z.enum(['development', 'production']).default('development'),
    MEDIASOUP_WORKERS_AMOUNT: z.coerce
      .number()
      .min(1, { error: 'MEDIASOUP_WORKERS_AMOUNT must be at least 1' }),
    MEDIASOUP_WORKER_RTC_MIN_PORT: z.coerce
      .number()
      .min(10000, { error: 'MEDIASOUP_WORKER_RTC_MIN_PORT must be at least 10000' })
      .max(59998, { error: 'MEDIASOUP_WORKER_RTC_MIN_PORT must be at most 59998' }),
    MEDIASOUP_WORKER_RTC_MAX_PORT: z.coerce
      .number()
      .min(10001, { error: 'MEDIASOUP_WORKER_RTC_MAX_PORT must be at least 10001' })
      .max(59999, { error: 'MEDIASOUP_WORKER_RTC_MAX_PORT must be at most 59999' }),
    MEDIASOUP_INCOMING_BITRATE: z.coerce.number().default(0),
    MEDIASOUP_OUTGOING_BITRATE: z.coerce.number().default(0),
    MAX_VISIBLE_ACTIVE_SPEAKER: z.coerce.number().default(3),
  })
  .refine((data) => data.MEDIASOUP_WORKER_RTC_MAX_PORT > data.MEDIASOUP_WORKER_RTC_MIN_PORT, {
    message: 'RTC_MAX_PORT must be greater than RTC_MIN_PORT',
  })

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid server environment variables:')
  for (const issue of _env.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const detectedIP = getLocalIP()
const allNetworkIPs = getAllNetworkIPs()

type Env = z.infer<typeof envSchema> & {
  LOCAL_IP: string
  ALL_IPS: string[]
  CORS_ORIGINS: string[]
  SERVER_URL: string
}

const env = Object.freeze({
  ..._env.data,
  LOCAL_IP: detectedIP,
  ALL_IPS: allNetworkIPs,
  CORS_ORIGINS: allNetworkIPs.map((ip) => `https://${ip}:${_env.data.CLIENT_PORT}`),
  SERVER_URL: `https://${detectedIP}:${_env.data.EXPRESS_PORT}`,
}) satisfies Env

export default env
