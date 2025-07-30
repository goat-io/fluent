import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./setup.ts'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true
  }
})
