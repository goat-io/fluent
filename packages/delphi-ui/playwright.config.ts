import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // Backend: test server with testcontainers
      command: 'npx tsx test-server/server.ts',
      port: 4444,
      timeout: 120_000, // testcontainers can be slow
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      // Frontend: Vite dev server
      command: 'npx vite --port 5173',
      port: 5173,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: 'http://localhost:4444',
        VITE_TENANT_ID: 'e2e-ui-tenant',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
