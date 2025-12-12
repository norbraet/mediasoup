import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { z } from 'zod'

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.development, etc.
  const raw = loadEnv(mode, process.cwd(), '')

  const schema = z.object({
    VITE_PORT: z.coerce.number().default(5173),
  })

  const env = schema.parse(raw)

  return {
    plugins: [vue()],
    server: {
      port: env.VITE_PORT,
      host: true,
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
