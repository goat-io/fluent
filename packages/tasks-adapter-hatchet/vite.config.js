import { defineConfig } from 'vitest/config'

import 'dotenv/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    // Run tests sequentially to avoid race conditions with shared Hatchet state
    sequence: {
      shuffle: false
    },
    // Longer timeout for Hatchet tests
    testTimeout: 30000
  }
})
