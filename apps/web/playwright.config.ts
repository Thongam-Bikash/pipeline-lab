import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
