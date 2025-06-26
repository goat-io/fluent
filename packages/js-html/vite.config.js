import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './setup.ts',
    environment: 'jsdom'
    //globals: true
    // server: {
    //   deps: {
    //     inline: ['keyv', '@keyv/redis']
    //   }
    // }
  }
})
