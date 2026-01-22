import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'msedge',
  },
  webServer: {
    command: 'npm run dev:web:e2e -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
  },
})
