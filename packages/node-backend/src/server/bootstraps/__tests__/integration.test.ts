// npx vitest run ./packages/node-backend/src/server/bootstraps/__tests__/integration.test.ts

import type { Server } from 'node:http'
import { initTRPC } from '@trpc/server'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { getExpressTrpcApp } from '../getExpressTrpcApp'

// Create a test TRPC router
const t = initTRPC.create()
const testRouter = t.router({
  greeting: t.procedure.query(() => 'Hello from minimal config!'),
  echo: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') {
        return val
      }
      throw new Error('Input must be a string')
    })
    .mutation(({ input }) => input),
})

describe('getExpressTrpcApp integration', () => {
  let server: Server | undefined

  afterEach(() => {
    // Clean up server after each test
    if (server) {
      server.close()
      server = undefined
    }
  })

  it('should create a working app with minimal configuration', async () => {
    const { app } = getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test', // Use test env to prevent server startup
    })

    // Test TRPC endpoint
    const trpcResponse = await request(app).get('/trpc/greeting').expect(200)

    expect(JSON.parse(trpcResponse.text)).toEqual({
      result: { data: 'Hello from minimal config!' },
    })

    // Test health endpoint (should exist by default)
    const healthResponse = await request(app).get('/health').expect(200)

    expect(healthResponse.body).toMatchObject({
      status: 'ok',
      service: '@goatlab/node-backend', // From package.json
    })

    // Test ready endpoint
    const readyResponse = await request(app).get('/ready').expect(200)

    expect(readyResponse.body).toMatchObject({
      service: 'ready',
    })
  })

  it('should handle custom configuration properly', async () => {
    const { app } = getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test',
      appName: 'Test API',
      appVersion: '3.0.0',
      healthCheck: {
        path: '/custom-health',
        customChecks: async () => ({ database: 'connected' }),
      },
    })

    // Test custom health endpoint
    const healthResponse = await request(app).get('/custom-health').expect(200)

    expect(healthResponse.body).toMatchObject({
      status: 'ok',
      service: 'Test API',
      version: '3.0.0',
      custom: { database: 'connected' },
    })

    // Default health path should not exist
    await request(app).get('/health').expect(404)
  })

  it('should apply security headers with defaults', async () => {
    const { app } = getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test',
    })

    const response = await request(app).get('/health').expect(200)

    // Check security headers applied by helmet
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['x-xss-protection']).toBe('1; mode=block')

    // Check custom security headers
    expect(response.headers['permissions-policy']).toContain('geolocation=()')
  })

  it('should handle CORS with minimal config', async () => {
    const { app } = getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test',
    })

    // Test CORS preflight
    const response = await request(app)
      .options('/trpc/greeting')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204) // OPTIONS requests return 204

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    )
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('should provide waitForShutdown function', async () => {
    const { waitForShutdown } = getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test',
    })

    expect(waitForShutdown).toBeDefined()
    expect(typeof waitForShutdown).toBe('function')

    // In test environment, server is undefined, so waitForShutdown should resolve immediately
    await expect(waitForShutdown()).resolves.toBeUndefined()
  })

  it('should enable compression by default', async () => {
    getExpressTrpcApp({
      trpcRouter: testRouter,
      environment: 'test',
    })

    // Create a large response to trigger compression
    const largeRouter = t.router({
      large: t.procedure.query(() => 'x'.repeat(2000)),
    })

    const { app: largeApp } = getExpressTrpcApp({
      trpcRouter: largeRouter,
      environment: 'test',
    })

    const response = await request(largeApp)
      .get('/trpc/large')
      .set('Accept-Encoding', 'gzip')
      .expect(200)

    // Check if response was compressed
    expect(response.headers['content-encoding']).toBe('gzip')
  })
})
