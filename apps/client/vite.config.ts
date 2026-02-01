import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ mode }) => {
  const raw = loadEnv(mode, process.cwd(), '')
  const schema = z.object({
    VITE_PORT: z.coerce.number().default(5173),
  })
  const env = schema.parse(raw)

  // eslint-disable-next-line no-undef
  const certPath = path.resolve(__dirname, '../server/create-cert.pem')
  // eslint-disable-next-line no-undef
  const keyPath = path.resolve(__dirname, '../server/create-cert-key.pem')

  return {
    plugins: [vue()],
    server: {
      port: env.VITE_PORT,
      host: true, // This allows network access
      https:
        fs.existsSync(certPath) && fs.existsSync(keyPath)
          ? {
              key: fs.readFileSync(keyPath),
              cert: fs.readFileSync(certPath),
            }
          : undefined,
    },
    build: {
      outDir: 'dist',
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})
