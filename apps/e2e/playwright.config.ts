import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    { name: 'mobile-setup', testMatch: /auth\.mobile\.setup\.ts$/, use: { ...devices['Pixel 7'] } },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: '.auth/mobile.json' },
      dependencies: ['mobile-setup'],
    },
  ],
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'pnpm --filter @floq/web dev',
          url: BASE_URL,
          reuseExistingServer: true as const,
          timeout: 120000,
        },
      }),
})
