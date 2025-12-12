/// <reference types="vite/client" />
import { z } from 'zod'

const envSchema = z.object({
  VITE_PORT: z.coerce
    .number()
    .min(1024, { error: 'VITE_PORT must be at least 1024' })
    .max(65535, { error: 'VITE_PORT must be at most 65535' }),
  VITE_API_URL: z
    .url({ error: 'VITE_API_URL must be a valid URL' })
    .default('https://localhost:3030'),
  VITE_WS_URL: z
    .url({ error: 'VITE_WS_URL must be a valid WebSocket URL' })
    .default('ws://localhost:3030'),
  VITE_DEBUG: z.coerce.boolean().default(false),
  VITE_APP_NAME: z
    .string()
    .min(1, { error: 'VITE_APP_NAME cannot be empty' })
    .default('Mediasoup Conference'),
})

const _env = envSchema.safeParse(import.meta.env)
if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format())
  throw new Error('Invalid environment configuration')
}

type Env = z.infer<typeof envSchema>
export const env: Env = _env.data
