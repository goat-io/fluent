import { defineConfig } from 'vitest/config'
import path from 'path'
import swc from 'unplugin-swc'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          tsx: true
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true
        },
        target: 'es2020'
      }
    })
  ],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['dotenv/config'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 600000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})