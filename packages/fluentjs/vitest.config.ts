import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Exclude tests that use old API or browser-specific features
      '**/Wrappers/Event.spec.js',
      '**/plugins/**/*.spec.js'
    ]
  },
  resolve: {
    alias: {
      '@goatlab/goat-fluent': '@goatlab/fluent'
    }
  }
})