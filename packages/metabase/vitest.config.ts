import { defineConfig } from 'vitest/config'
import 'dotenv/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    maxConcurrency: 1,
    fileParallelism: false
  }
})
