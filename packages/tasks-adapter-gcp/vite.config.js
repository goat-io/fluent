import { defineConfig } from 'vitest/config'

import 'dotenv/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    // Run tests sequentially to avoid race conditions
    sequence: {
      shuffle: false
    },
    // Timeout for GCP tests
    testTimeout: 20000
  }
})
