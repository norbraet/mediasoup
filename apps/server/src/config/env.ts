import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z
  .object({
    EXPRESS_PORT: z.coerce.number().min(1000),
    ENVIRONMENT: z
      .union([z.literal('development'), z.literal('production')])
      .default('development'),
    CORS_ORIGIN: z.coerce.string(),
    MEDIASOUP_WORKERS_AMOUNT: z.coerce.number().min(1),
    MEDIASOUP_WORKER_RTC_MIN_PORT: z.coerce.number().min(10000).max(59998),
    MEDIASOUP_WORKER_RTC_MAX_PORT: z.coerce.number().min(10001).max(59999),
  })
  .refine((data) => data.MEDIASOUP_WORKER_RTC_MAX_PORT > data.MEDIASOUP_WORKER_RTC_MIN_PORT, {
    message: 'RTC_MAX_PORT must be greater than RTC_MIN_PORT',
  })

const env = envSchema.parse(process.env)

export default env
