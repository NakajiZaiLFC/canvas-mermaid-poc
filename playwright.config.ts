import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', timeout: 30_000, fullyParallel: false, workers: 1,
  use: {
    baseURL: process.env.TEST_URL || 'http://127.0.0.1:4173',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    launchOptions: process.env.CI || process.env.PLAYWRIGHT_CHROMIUM || process.platform !== 'darwin' ? {} : { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  },
  webServer: process.env.TEST_URL ? undefined : {
    command: process.env.PRODUCTION_TEST ? 'npm run preview -- --port 4173 --strictPort' : 'npm run dev -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI,
  },
})
