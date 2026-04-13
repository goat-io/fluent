import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  }
})
