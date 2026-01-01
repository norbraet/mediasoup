/// <reference types="vite/client" />
import { z } from 'zod'

/**
 * Automatically detects the server IP based on the current browser location
 * This allows the app to work across different networks without manual configuration
 */
function getServerIP(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return hostname
    }
  }
  // Fallback to localhost for development
  return 'localhost'
}

const envSchema = z.object({
  VITE_PORT: z.coerce
    .number()
    .min(1024, { message: 'VITE_PORT must be at least 1024' })
    .max(65535, { message: 'VITE_PORT must be at most 65535' }),
  VITE_API_PORT: z.coerce.number().min(1000, { message: 'VITE_API_PORT must be at least 1000' }),
  VITE_API_PROTOCOL: z
    .enum(['http', 'https'], { message: 'VITE_API_PROTOCOL must be http or https' })
    .default('https'),
  VITE_WS_PROTOCOL: z
    .enum(['ws', 'wss'], { message: 'VITE_WS_PROTOCOL must be ws or wss' })
    .default('wss'),
  VITE_DEBUG: z.coerce.boolean().default(false),
  VITE_APP_NAME: z
    .string()
    .min(1, { message: 'VITE_APP_NAME cannot be empty' })
    .default('Mediasoup Conference'),
})

const _env = envSchema.safeParse(import.meta.env)
if (!_env.success) {
  console.error('❌ Invalid environment variables:')
  for (const issue of _env.error.issues) {
    console.error(`- ${issue.path.join('.') || 'root'}: ${issue.message}`)
  }
  throw new Error('Invalid environment configuration')
}

const serverIP = getServerIP()

type Env = z.infer<typeof envSchema> & {
  VITE_LOCAL_IP: string
  VITE_API_URL: string
  VITE_WS_URL: string
}

export const env = Object.freeze({
  ..._env.data,
  // Auto-detected values
  VITE_LOCAL_IP: serverIP,
  VITE_API_URL: `${_env.data.VITE_API_PROTOCOL}://${serverIP}:${_env.data.VITE_API_PORT}`,
  VITE_WS_URL: `${_env.data.VITE_WS_PROTOCOL}://${serverIP}:${_env.data.VITE_API_PORT}`,
}) satisfies Env

// Development logging
if (_env.data.VITE_DEBUG) {
  console.log('🔧 Client Environment Configuration:')
  console.log(`   Server IP: ${serverIP}`)
  console.log(`   API URL: ${env.VITE_API_URL}`)
  console.log(`   WebSocket URL: ${env.VITE_WS_URL}`)
  console.log(`   Client Port: ${env.VITE_PORT}`)
}
