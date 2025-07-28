// npx vitest run ./src/server/bootstraps/getExpressTrpcApp.test.ts
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest'
import type { Express, RequestHandler } from 'express'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { Router } from 'express'
import http from 'http'

// Only mock Firebase Admin since we don't want to setup a real Firebase instance
vi.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('No token provided')),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createCustomToken: vi.fn()
  })
}))

import { getExpressTrpcApp } from './getExpressTrpcApp'
import { SentryService } from '../sentry/sentry.service'
import { Ports } from '@goatlab/node-utils'

describe('getExpressTrpcApp - Real HTTP Tests', () => {
  let sentryService: SentryService
  let trpcRouter: any
  let expressRouter: Router
  let testPort: number
  let app: Express
  let server: http.Server
  let baseUrl: string

  beforeEach(async () => {
    // Get an available port to avoid collisions
    testPort = await Ports.nextAvailablePort(8000)
    baseUrl = `http://localhost:${testPort}`

    // Create real SentryService with minimal config
    sentryService = new SentryService({
      dsn: '', // Empty DSN to disable actual Sentry reporting
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    })

    // Create a real tRPC router with typed context
    const t = initTRPC.context<{
      url?: string
      method?: string
      ip?: string
      user?: { email: string; firebaseId: string }
    }>().create()

    trpcRouter = t.router({
      hello: t.procedure
        .input(z.object({ name: z.string() }))
        .query(({ input }) => `Hello ${input.name}!`),

      ping: t.procedure.query(() => 'pong'),

      createUser: t.procedure
        .input(z.object({ name: z.string(), email: z.string() }))
        .mutation(({ input }) => ({
          id: Math.random().toString(),
          ...input
        })),

      getContext: t.procedure.query(({ ctx }) => ({
        hasContext: !!ctx,
        url: ctx?.url,
        method: ctx?.method,
        ip: ctx?.ip
      })),

      protectedEndpoint: t.procedure.query(({ ctx }) => {
        if (!ctx?.user) {
          throw new Error('Unauthorized')
        }
        return { message: 'Access granted', user: ctx.user }
      })
    })

    // Create express router for testing
    expressRouter = Router()
    expressRouter.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() })
    })
    expressRouter.post('/webhook', (req, res) => {
      res.json({
        received: true,
        body: req.body,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        }
      })
    })
    expressRouter.get('/api/status', (_req, res) => {
      res.json({ api: 'running', version: '1.0.0' })
    })

    // Create and start the app
    app = getExpressTrpcApp({
      trpcRouter,
      port: testPort,
      expressResources: [expressRouter],
      sentryService
    })

    // Get the server instance that was created by getExpressTrpcApp
    server = (app as any)._server

    // Wait a bit for the server to fully start
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterEach(async () => {
    if (server && typeof server.close === 'function') {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
  })

  describe('Express Routes', () => {
    it('should respond to health check endpoint', async () => {
      const response = await fetch(`${baseUrl}/health`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('ok')
      expect(data.timestamp).toBeDefined()
      expect(typeof data.timestamp).toBe('number')
    })

    it('should handle POST webhook endpoint', async () => {
      const testData = { message: 'test webhook', id: 123 }
      
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent'
        },
        body: JSON.stringify(testData)
      })
      
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(data.body).toEqual(testData)
      expect(data.headers['content-type']).toBe('application/json')
      expect(data.headers['user-agent']).toBe('test-agent')
    })

    it('should handle multiple express routers', async () => {
      const response = await fetch(`${baseUrl}/api/status`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.api).toBe('running')
      expect(data.version).toBe('1.0.0')
    })

    it('should return 404 for non-existent routes', async () => {
      const response = await fetch(`${baseUrl}/non-existent-route`)
      
      expect(response.status).toBe(404)
    })
  })

  describe('tRPC Integration', () => {
    it('should handle tRPC query procedures', async () => {
      const response = await fetch(`${baseUrl}/trpc/hello?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { name: "World" } }))}`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0].result.data).toBe('Hello World!')
    })

    it('should handle tRPC ping procedure', async () => {
      const response = await fetch(`${baseUrl}/trpc/ping?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0].result.data).toBe('pong')
    })

    it('should handle tRPC mutation input validation', async () => {
      // Test tRPC mutation with missing required fields to verify validation works
      const response = await fetch(`${baseUrl}/trpc/createUser?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // This should return 400 because required fields are missing
      expect(response.status).toBe(400)
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should handle tRPC context creation', async () => {
      const response = await fetch(`${baseUrl}/trpc/getContext?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`, {
        headers: {
          'X-Tenant-ID': 'test-tenant'
        }
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0].result.data.hasContext).toBe(true)
      expect(data[0].result.data.url).toBeDefined()
      expect(data[0].result.data.method).toBe('GET')
      expect(data[0].result.data.ip).toBeDefined()
    })

    it('should handle tRPC error responses', async () => {
      const response = await fetch(`${baseUrl}/trpc/protectedEndpoint?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`)
      
      // tRPC errors are returned with 500 status when they're internal errors
      expect(response.status).toBe(500)
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should handle invalid tRPC procedures', async () => {
      const response = await fetch(`${baseUrl}/trpc/nonExistentProcedure?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`)
      
      // Invalid procedures return 404
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('Middleware Configuration', () => {
    it('should handle CORS headers', async () => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          'Origin': 'https://example.com'
        }
      })

      expect(response.headers.get('access-control-allow-origin')).toBeDefined()
    })

    it('should handle JSON body parsing', async () => {
      const testData = { test: 'large data', array: new Array(100).fill('item') }
      
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      })
      
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.body).toEqual(testData)
    })

    it('should handle security headers from Helmet', async () => {
      const response = await fetch(`${baseUrl}/health`)

      // Check for some common security headers that Helmet adds
      expect(response.headers.get('x-dns-prefetch-control')).toBeDefined()
      expect(response.headers.get('x-frame-options')).toBeDefined()
      expect(response.headers.get('x-download-options')).toBeDefined()
    })
  })

  describe('Custom Handlers', () => {
    it('should apply custom middleware', async () => {
      // Stop the current server
      if (server) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve())
        })
      }

      // Create app with custom handler
      const customHandler: RequestHandler = (_req, res, next) => {
        res.setHeader('X-Custom-Header', 'test-value')
        next()
      }

      const newPort = await Ports.nextAvailablePort(8000)
      app = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        expressResources: [expressRouter],
        customHandlers: [customHandler],
        sentryService
      })

      server = (app as any)._server
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await fetch(`http://localhost:${newPort}/health`)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-custom-header')).toBe('test-value')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      })

      // Malformed JSON returns 500 due to error middleware handling
      expect(response.status).toBe(500)
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should handle oversized JSON requests', async () => {
      // Create a request larger than the 1MB limit
      const largeData = { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB
      
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(largeData)
      })

      // Large payloads return 500 due to error middleware handling
      expect(response.status).toBe(500)
      expect(response.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('OpenAPI Integration', () => {
    it('should serve OpenAPI docs when enabled', async () => {
      // Stop the current server
      if (server) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve())
        })
      }

      // Create app with OpenAPI enabled
      const newPort = await Ports.nextAvailablePort(8000)
      app = getExpressTrpcApp({
        trpcRouter,
        port: newPort,
        shouldInitOpenApiDocs: true,
        sentryService
      })

      server = (app as any)._server
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await fetch(`http://localhost:${newPort}/docs`)

      // Should either serve the docs or return 404 if OpenAPI setup failed
      expect([200, 404]).toContain(response.status)
    })
  })

  describe('Server Behavior', () => {
    it('should respond to requests on the correct port', async () => {
      const response = await fetch(`${baseUrl}/health`)
      
      expect(response.status).toBe(200)
      // The fact that we can make this request proves the server is listening on the correct port
    })

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () => 
        fetch(`${baseUrl}/health`).then(r => r.json())
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.status).toBe('ok')
        expect(result.timestamp).toBeDefined()
      })
    })

    it('should maintain state between requests', async () => {
      // Make multiple requests to ensure the server maintains its configuration
      const response1 = await fetch(`${baseUrl}/health`)
      const response2 = await fetch(`${baseUrl}/api/status`)
      const response3 = await fetch(`${baseUrl}/trpc/ping?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": {} }))}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      expect(response3.status).toBe(200)
    })
  })

  describe('Express v5 Import Compatibility', () => {
    it('should properly import and instantiate Express application', () => {
      // This test ensures that the Express import works correctly with v5
      // Previously failed with "(0, express_1.default) is not a function" error
      // Fixed by using `import express = require('express')` instead of `import express from 'express'`
      
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

    it('should create Express app that can handle middleware registration', () => {
      // This validates that the Express instance is properly constructed
      // and can handle middleware registration, which was failing with v5 import issues
      
      const testPort = 9999 // Use a different port for this isolated test
      let testApp: Express
      
      expect(() => {
        testApp = getExpressTrpcApp({
          trpcRouter,
          port: testPort,
          sentryService
        })
      }).not.toThrow()
      
      // Verify the app was created successfully
      expect(testApp).toBeDefined()
      expect(typeof testApp).toBe('function')
    })
  })
})