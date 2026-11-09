import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { include: ['src/test/hatchet.fixture.test.ts'], environment: 'node' },
})
