import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['server/runtime.spec.ts'], testTimeout: 30_000 } })
