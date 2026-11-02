// cd packages/node-backend && pnpm exec vitest run --config vitest.config-regression.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: [
      'src/server/bootstraps/__tests__/router-config-identity.test.ts',
      'src/server/bootstraps/__tests__/getExpressTrpcApp.test.ts',
      'src/server/bootstraps/__tests__/config-edge-cases.test.ts',
      'src/server/middleware/logs.middleware*.test.ts',
    ],
  },
})
