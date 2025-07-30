import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes for container setup
    hookTimeout: 120000,
    teardownTimeout: 60000,
    include: ['src/**/*.container.test.ts'],
    globalSetup: './src/setup/containerSetup.ts',
    sequence: {
      hooks: 'parallel',
      concurrent: false // Run container tests sequentially
    },
    maxConcurrency: 1
  }
})
