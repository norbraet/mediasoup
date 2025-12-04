import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { env } from './src/config/env.js'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: env.VITE_PORT,
    host: true,
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
