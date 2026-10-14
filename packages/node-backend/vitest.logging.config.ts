// pnpm exec vitest run --config vitest.logging.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/middleware/logs.middleware*.test.ts'],
    fileParallelism: false,
  },
})
