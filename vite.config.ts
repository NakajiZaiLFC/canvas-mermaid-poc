import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'cloud-ai-connect-policy',
    transformIndexHtml(html) {
      const endpoint = (process.env.VITE_AI_ENDPOINT ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_AI_ENDPOINT)?.trim()
      if (!endpoint) return html
      const url = new URL(endpoint)
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('AI endpoint must use HTTPS')
      return html.replace("connect-src 'self'", "connect-src 'self' " + url.origin)
    },
  }],
  base: process.env.BASE_PATH || '/',
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' },
}))
