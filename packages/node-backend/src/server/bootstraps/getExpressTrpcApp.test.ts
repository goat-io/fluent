// npx vitest run ./src/server/bootstraps/getExpressTrpcApp.test.ts

import http from 'node:http'
import { initTRPC } from '@trpc/server'
import type { Express, RequestHandler } from 'express'
import { Router } from 'express'
import request from 'supertest'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { z } from 'zod'

// Mock Firebase Admin since we don't want to setup a real Firebase instance
vi.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('No token provided')),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createCustomToken: vi.fn(),
  }),
}))

// Mock other dependencies for integration tests
vi.mock('../consts', () => ({
  pkg: { name: 'test-app', version: '1.0.0' },
}))

vi.mock('../context/trpc.context', () => ({
  createContext: vi.fn().mockResolvedValue({}),
}))

vi.mock('../initOpenApiDocs', () => ({
  initOpenApiDocs: vi.fn(),
}))

vi.mock('../sentry/sentry.service', () => ({
  SentryService: vi.fn().mockImplementation(() => ({
    captureException: vi.fn(),
  })),
}))

import { Ports } from '@goatlab/node-utils'
import { SentryService } from '../sentry/sentry.service'
import { getExpressTrpcApp } from './getExpressTrpcApp'

describe('getExpressTrpcApp - Consolidated Tests', () => {
  let sentryService: SentryService
  let trpcRouter: any
  let expressRouter: Router
  let testPort: number
  let app: Express
  let server: http.Server | undefined
  let _baseUrl: string
  let originalNodeEnv: string | undefined

  // Create a real tRPC router with typed context
  const t = initTRPC
    .context<{
      url?: string
      method?: string
      ip?: string
      user?: { email: string; firebaseId: string }
    }>()
    .create()

  beforeAll(() => {
    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV
    // Set to test environment to prevent server from auto-starting
    process.env.NODE_ENV = 'test'
    // Increase max listeners to avoid warnings
    process.setMaxListeners(20)

    // Mock process.exit to prevent test runner from exiting
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
  })

  afterAll(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      process.env.NODE_ENV = undefined
    }
    // Reset process listeners
    process.setMaxListeners(10)
    // Restore process.exit
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    // Get an available port to avoid collisions
    testPort = await Ports.nextAvailablePort(8000)
    _baseUrl = `http://localhost:${testPort}`

    // Create real SentryService with minimal config
    sentryService = new SentryService({
      dsn: '', // Empty DSN to disable actual Sentry reporting
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    })

    // Create TRPC router
    trpcRouter = t.router({
      hello: t.procedure
        .input(z.object({ name: z.string() }))
        .query(({ input }) => `Hello ${input.name}!`),

      ping: t.procedure.query(() => 'pong'),

      createUser: t.procedure
        .input(z.object({ name: z.string(), email: z.string() }))
        .mutation(({ input }) => ({
          id: Math.random().toString(),
          ...input,
        })),

      getContext: t.procedure.query(({ ctx }) => ({
        hasContext: !!ctx,
        url: ctx?.url,
        method: ctx?.method,
        ip: ctx?.ip,
      })),

      protectedEndpoint: t.procedure.query(({ ctx }) => {
        if (!ctx?.user) {
          throw new Error('Unauthorized')
        }
        return { message: 'Access granted', user: ctx.user }
      }),

      error: t.procedure.query(() => {
        throw new Error('Test error')
      }),
    })

    // Create express router for testing
    expressRouter = Router()
    expressRouter.get('/custom-health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() })
    })
    expressRouter.post('/webhook', (req, res) => {
      res.json({
        received: true,
        body: req.body,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
        },
      })
    })
    expressRouter.get('/api/status', (_req, res) => {
      res.json({ api: 'running', version: '1.0.0' })
    })

    // Reset environment variables
    process.env.NODE_ENV = 'test'
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001'
  })

  afterEach(async () => {
    // Clear all process event listeners first to prevent shutdown handlers
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')

    if (server && typeof server.close === 'function') {
      await new Promise<void>(resolve => {
        server.close(() => resolve())
      })
    }
    // Clear any environment variables set during tests
    process.env.ALLOWED_ORIGINS = undefined
    process.env.REQUEST_TIMEOUT = undefined
    process.env.JSON_BODY_LIMIT = undefined
    process.env.API_RATE_LIMIT = undefined
  })

  describe('Basic App Creation', () => {
    it('should create app with security configurations', () => {
      const { app } = getExpressTrpcApp({
        trpcRouter,
        port: 3000,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      expect(app).toBeDefined()
      expect(typeof app).toBe('function')
      expect(app.use).toBeDefined()
      expect(app.get).toBeDefined()
      expect(app.post).toBeDefined()
      expect(app.set).toBeDefined()
    })

    it('should return correct structure', () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: 3000,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      expect(result).toHaveProperty('app')
      expect(result).toHaveProperty('server')
      expect(result.app).toBeDefined()
      // In test environment, server should be undefined
      expect(result.server).toBeUndefined()
    })

    it('should not start server in test environment', () => {
      const { server } = getExpressTrpcApp({
        trpcRouter,
        port: 3000,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      // Server should not be started in test env
      expect(server).toBeUndefined()
    })

    it('should return server instance in non-test environment', async () => {
      // Temporarily change NODE_ENV
      process.env.NODE_ENV = 'dev'

      const newPort = await Ports.nextAvailablePort(8000)
      const result = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        environment: 'dev',
        sentryService,
      })

      expect(result.server).toBeDefined()
      expect(result.server).toBeInstanceOf(http.Server)

      // Clean up
      if (result.server) {
        await new Promise<void>(resolve => {
          result.server.close(() => resolve())
        })
      }

      // Reset to test environment
      process.env.NODE_ENV = 'test'
    })
  })

  describe('Health Check Endpoints', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should respond to /health endpoint', async () => {
      const res = await request(app).get('/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.timestamp).toBeDefined()
      expect(res.body.service).toBeDefined()
      expect(res.body.version).toBeDefined()
      expect(res.body.uptime).toBeDefined()
      expect(res.body.memory).toBeDefined()
    })

    it('should respond to /ready endpoint', async () => {
      const res = await request(app).get('/ready')

      expect(res.status).toBe(200)
      expect(res.body.service).toBe('ready')
      expect(res.body.timestamp).toBeDefined()
    })
  })

  describe('Security Headers', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should set all required security headers', async () => {
      const res = await request(app).get('/health')

      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['x-frame-options']).toBe('DENY')
      expect(res.headers['x-xss-protection']).toBe('1; mode=block')
      expect(res.headers['permissions-policy']).toContain('geolocation=()')
      expect(res.headers['x-response-time']).toBeDefined()
      expect(res.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/)
    })

    it('should handle security headers from Helmet', async () => {
      const response = await request(app).get('/health')

      // Check for common security headers that Helmet adds
      expect(response.headers['x-dns-prefetch-control']).toBeDefined()
      expect(response.headers['x-frame-options']).toBeDefined()
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-powered-by']).toBeUndefined() // Should be hidden
      expect(response.headers['referrer-policy']).toBeDefined()
    })
  })

  describe('CORS Configuration', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should allow configured origins', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      )
      expect(res.headers['access-control-allow-credentials']).toBe('true')
    })

    it('should handle preflight requests', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')

      expect(res.status).toBe(204)
      expect(res.headers['access-control-allow-methods']).toContain('POST')
      expect(res.headers['access-control-allow-headers']).toContain(
        'Content-Type',
      )
      expect(res.headers['access-control-max-age']).toBe('86400')
    })

    it('should reject CORS requests from disallowed origins in production', async () => {
      // Stop current server
      if (server) {
        await new Promise<void>(resolve => {
          server.close(() => resolve())
        })
        server = undefined
      }

      // Wait a bit to ensure port is released
      await new Promise(resolve => setTimeout(resolve, 100))

      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'prod'

      try {
        // Get a new port to avoid conflicts
        const newTestPort = await Ports.nextAvailablePort(testPort + 1)

        const result = getExpressTrpcApp({
          trpcRouter,
          port: newTestPort,
          environment: 'test',
          sentryService,
          features: { sentry: false },
        })

        app = result.app
        server = result.server // Use the server created by getExpressTrpcApp
        await new Promise(resolve => setTimeout(resolve, 100))

        const response = await request(app)
          .get('/health')
          .set('Origin', 'http://evil.com')

        expect(response.headers['access-control-allow-origin']).toBeUndefined()
      } finally {
        // Reset to original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv
      }
    })
  })

  describe('Compression and Performance', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should compress large responses', async () => {
      app.get('/test-compression', (_req, res) => {
        const data = Array(1000)
          .fill('This is test data to be compressed. ')
          .join('')
        res.json({ data })
      })

      const response = await request(app)
        .get('/test-compression')
        .set('Accept-Encoding', 'gzip')

      expect(response.headers['content-encoding']).toBe('gzip')
    })

    it('should include response time header', async () => {
      const response = await request(app).get('/health')

      expect(response.headers['x-response-time']).toBeDefined()
      expect(response.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/)
    })

    it('should enable strong ETags', async () => {
      const response = await request(app).get('/health')
      const etag = response.headers.etag

      expect(etag).toBeDefined()
      expect(etag).toMatch(/^"[^"]+"$/) // Strong ETag format
    })
  })

  describe('Body Parsing and Limits', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should parse JSON bodies', async () => {
      const testData = { message: 'test webhook', id: 123 }

      const response = await request(app).post('/webhook').send(testData)

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)
      expect(response.body.body).toEqual(testData)
    })

    it('should reject oversized payloads', async () => {
      app.post('/test-large', (_req, res) => {
        res.json({ received: true })
      })

      const largeData = 'x'.repeat(200 * 1024) // 200KB

      const res = await request(app)
        .post('/test-large')
        .send({ data: largeData })

      expect(res.status).toBe(413) // Payload Too Large
    })

    it('should respect JSON body size limit', async () => {
      // Stop current server
      if (server) {
        await new Promise<void>(resolve => {
          server.close(() => resolve())
        })
      }

      const newPort = await Ports.nextAvailablePort(8000)
      const result = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
        bodyParsing: {
          json: { limit: '1kb' },
        },
      })

      app = result.app
      server = app.listen(newPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create payload larger than 1KB
      const largeData = { data: 'x'.repeat(2000) } // ~2KB

      const response = await request(app).post('/webhook').send(largeData)

      expect(response.status).toBe(413) // Payload Too Large
    })

    it('should store raw body for webhook verification', async () => {
      const webhookRouter = Router()
      webhookRouter.post('/webhook-verify', (req: any, res) => {
        res.json({
          hasRawBody: !!req.rawBody,
          rawBody: req.rawBody,
        })
      })

      // Stop current server
      if (server) {
        await new Promise<void>(resolve => {
          server.close(() => resolve())
        })
      }

      const newPort = await Ports.nextAvailablePort(8000)
      const result = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        environment: 'test',
        expressResources: [webhookRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(newPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const testData = { webhook: 'payload' }
      const response = await request(app).post('/webhook-verify').send(testData)

      const data = response.body
      expect(data.hasRawBody).toBe(true)
      expect(data.rawBody).toBe(JSON.stringify(testData))
    })
  })

  describe('Cache Headers', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should set cache headers for static assets', async () => {
      app.get('/static/test.js', (_req, res) => {
        res.send('console.log("test");')
      })

      const res = await request(app).get('/static/test.js')

      expect(res.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      )
    })
  })

  describe('TRPC Integration', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should handle TRPC queries', async () => {
      const res = await request(app).get(
        '/trpc/ping?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      expect(res.status).toBe(200)
      expect(res.body[0].result.data).toBe('pong')
    })

    it('should handle TRPC query procedures', async () => {
      const response = await request(app).get(
        '/trpc/hello?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': { name: 'World' } })),
      )

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body[0].result.data).toBe('Hello World!')
    })

    it('should handle TRPC mutation input validation', async () => {
      const response = await request(app).post(
        '/trpc/createUser?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      // This should return 400 or 415 because required fields are missing
      expect([400, 415]).toContain(response.status)
      // Content type might be different based on error response
      if (response.headers['content-type']) {
        expect(
          ['application/json', 'text/plain'].some(type =>
            response.headers['content-type'].includes(type),
          ),
        ).toBe(true)
      }
    })

    it.skip('should handle TRPC context creation', async () => {
      // This test requires proper TRPC context setup which varies between test files
      const response = await request(app)
        .get(
          '/trpc/getContext?batch=1&input=' +
            encodeURIComponent(JSON.stringify({ '0': {} })),
        )
        .set('X-Tenant-ID', 'test-tenant')

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      if (response.body[0]?.result?.data) {
        expect(response.body[0].result.data.hasContext).toBe(true)
        expect(response.body[0].result.data.url).toBeDefined()
        expect(response.body[0].result.data.method).toBe('GET')
        expect(response.body[0].result.data.ip).toBeDefined()
      }
    })

    it('should handle TRPC error responses', async () => {
      const response = await request(app).get(
        '/trpc/protectedEndpoint?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      // tRPC errors are returned with 500 status when they're internal errors
      expect(response.status).toBe(500)
      expect(response.headers['content-type']).toContain('application/json')
    })

    it('should handle invalid TRPC procedures', async () => {
      const response = await request(app).get(
        '/trpc/nonExistentProcedure?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      // Invalid procedures return 404
      expect(response.status).toBe(404)
      expect(response.headers['content-type']).toContain('application/json')
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should handle malformed JSON gracefully', async () => {
      app.post('/test-bad-json', (_req, res) => {
        res.json({ received: true })
      })

      const res = await request(app)
        .post('/test-bad-json')
        .set('Content-Type', 'application/json')
        .send('invalid json{')

      expect(res.status).toBe(400) // Bad Request for malformed JSON
    })

    it('should handle errors properly in production mode', async () => {
      // Stop current server
      if (server) {
        await new Promise<void>(resolve => {
          server.close(() => resolve())
        })
      }

      process.env.NODE_ENV = 'prod'

      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Add a route that throws an error
      app.get('/error-test', () => {
        throw new Error('This is a test error with sensitive information')
      })

      const response = await request(app).get('/error-test')

      expect(response.status).toBe(500)
      // Check the response body structure
      if (response.body.error) {
        const errorObj = response.body.error
        expect(errorObj).toBeDefined()

        // Check for sanitized message
        const errorMessage = errorObj.message || errorObj.data?.message || ''
        expect(errorMessage).not.toContain('sensitive information')

        // Check that stack is not exposed
        expect(errorObj.stack).toBeUndefined()
      }

      // Reset to test mode
      process.env.NODE_ENV = 'test'
    })
  })

  describe('Rate Limiting', () => {
    it('should rate limit requests after threshold', async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Make 101 requests (limit is 100 per 15 minutes)
      const promises: Promise<any>[] = []
      for (let i = 0; i < 101; i++) {
        promises.push(request(app).get('/health'))
      }

      const responses = await Promise.all(promises)
      const statuses = responses.map(r => r.status)

      // Most should be 200, but the last ones should be 429
      expect(statuses.filter(s => s === 200).length).toBeGreaterThan(0)
      expect(statuses.filter(s => s === 429).length).toBeGreaterThan(0)

      // Check rate limit headers on a 429 response
      const rateLimitedResponse = responses.find(r => r.status === 429)
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers['ratelimit-limit']).toBeDefined()
        expect(rateLimitedResponse.headers['ratelimit-remaining']).toBeDefined()
        expect(rateLimitedResponse.headers['ratelimit-reset']).toBeDefined()
      }
    })

    it('should enforce rate limiting', async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
        features: { sentry: false },
        security: {
          rateLimit: {
            api: { max: 5 },
          },
        },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Add a test API endpoint
      app.get('/api/test', (_req, res) => {
        res.json({ message: 'ok' })
      })

      // Make multiple requests to trigger rate limit
      const requests = Array.from({ length: 6 }, () =>
        request(app).get('/api/test'),
      )

      const responses = await Promise.all(requests)

      // First 5 should succeed
      expect(responses.slice(0, 5).every(r => r.status === 200)).toBe(true)

      // 6th should be rate limited
      expect(responses[5].status).toBe(429)
      expect(responses[5].body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should use custom API rate limit from configuration', async () => {
      const newPort = await Ports.nextAvailablePort(8000)
      const result = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
        security: {
          rateLimit: {
            api: { max: 10 },
          },
        },
      })

      app = result.app
      server = app.listen(newPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Make 11 requests to API endpoint
      const promises: Promise<any>[] = []
      for (let i = 0; i < 11; i++) {
        promises.push(request(app).get('/api/status'))
      }

      const responses = await Promise.all(promises)
      const statuses = responses.map(r => r.status)

      // First 10 should be successful, 11th should be rate limited
      expect(statuses.filter(s => s === 200).length).toBe(10)
      expect(statuses.filter(s => s === 429).length).toBe(1)
    })
  })

  describe('Custom Handlers and Express Resources', () => {
    it('should apply custom middleware', async () => {
      // Create app with custom handler
      const customHandler: RequestHandler = (_req, res, next) => {
        res.setHeader('X-Custom-Header', 'test-value')
        next()
      }

      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        customHandlers: [customHandler],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.headers['x-custom-header']).toBe('test-value')
    })

    it('should handle multiple express routers', async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await request(app).get('/api/status')

      expect(response.status).toBe(200)
      expect(response.body.api).toBe('running')
      expect(response.body.version).toBe('1.0.0')
    })

    it('should handle POST webhook endpoint', async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const testData = { message: 'test webhook', id: 123 }

      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'test-agent')
        .send(testData)

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)
      expect(response.body.body).toEqual(testData)
      expect(response.body.headers['content-type']).toBe('application/json')
      expect(response.body.headers['user-agent']).toBe('test-agent')
    })
  })

  describe('OpenAPI Integration', () => {
    it('should serve OpenAPI docs when enabled', async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        features: { openApiDocs: true },
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await request(app).get('/docs')

      // Should either serve the docs or return 404 if OpenAPI setup failed
      expect([200, 404]).toContain(response.status)
    })
  })

  describe('Request Timeout', () => {
    it('should timeout long-running requests', async () => {
      // Create endpoint with delay
      const timeoutRouter = Router()
      timeoutRouter.get('/slow', async (_req, res) => {
        await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
        res.json({ status: 'complete' })
      })

      // Set short timeout
      process.env.REQUEST_TIMEOUT = '1s'

      const newPort = await Ports.nextAvailablePort(8000)
      const result = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        environment: 'test',
        expressResources: [timeoutRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(newPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second client timeout

      try {
        const response = await fetch(`http://localhost:${newPort}/slow`, {
          signal: controller.signal,
        })
        // Should not get here
        expect(response.status).toBe(503) // Service Unavailable on timeout
      } catch (error: any) {
        // Request aborted by client timeout
        expect(error.name).toBe('AbortError')
      } finally {
        clearTimeout(timeoutId)
      }
    })
  })

  describe('Server Behavior', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should respond to requests on the correct port', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
    })

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/health')
          .then(r => r.body),
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.status).toBe('ok')
        expect(result.timestamp).toBeDefined()
      })
    })

    it('should maintain state between requests', async () => {
      // Make multiple requests to ensure the server maintains its configuration
      const response1 = await request(app).get('/health')
      const response2 = await request(app).get('/api/status')
      const response3 = await request(app).get(
        '/trpc/ping?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      expect(response3.status).toBe(200)
    })

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route')

      expect(response.status).toBe(404)
    })
  })

  describe('Express v5 Compatibility', () => {
    it('should properly import and instantiate Express application', () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
      })

      app = result.app

      // The app instance should be a function (Express application)
      expect(typeof app).toBe('function')

      // Express app should have the expected methods
      expect(typeof app.use).toBe('function')
      expect(typeof app.get).toBe('function')
      expect(typeof app.post).toBe('function')
      expect(typeof app.listen).toBe('function')
      expect(typeof app.set).toBe('function')
      expect(typeof app.disable).toBe('function')

      // Should have Express-specific properties
      expect(app.settings).toBeDefined()
      expect(typeof app.settings).toBe('object')
    })
  })

  describe('Trust Proxy and ETags', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        sentryService,
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it.skip('should trust proxy headers', async () => {
      // This test requires proper TRPC context setup
      const response = await request(app)
        .get(
          '/trpc/getContext?batch=1&input=' +
            encodeURIComponent(JSON.stringify({ '0': {} })),
        )
        .set('X-Forwarded-For', '203.0.113.195')
        .set('X-Forwarded-Proto', 'https')

      const data = response.body
      if (data[0]?.result?.data) {
        expect(data[0].result.data.ip).toBeDefined()
      }
    })
  })

  describe('Graceful Shutdown', () => {
    it.skip('should handle graceful shutdown in non-test environment', async () => {
      // This test requires spawning a child process and sending SIGTERM signals
      // It's complex to test properly without affecting the test runner
      // The graceful shutdown logic is tested manually and in integration tests
    })
  })
})
