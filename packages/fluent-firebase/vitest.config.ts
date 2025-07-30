import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    setupFiles: ['./src/test/setup-tests.ts']
  }
})
