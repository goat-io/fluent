// npx vitest run ./src/server/bootstraps/getExpressTrpcApp.simple.test.ts

import fs from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ports, Security } from '@goatlab/node-utils'
import { initTRPC } from '@trpc/server'
import type { Express } from 'express'
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

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('No token provided')),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createCustomToken: vi.fn(),
  }),
}))

// Mock the consts to provide test-specific values
vi.mock('../consts', () => ({
  pkg: { name: 'test-app', version: '1.0.0' },
  config: { langDir: join(__dirname, '../../../test/fixtures/lang') },
}))

// Container context that will be set during test setup
let testContainerContext: any = null

// Mock context creation to use our container
vi.mock('../context/trpc.context', () => ({
  createContextFactory: vi.fn().mockReturnValue(
    vi.fn().mockImplementation(async () => ({
      services: testContainerContext,
    })),
  ),
  createContext: vi.fn().mockImplementation(async () => ({
    services: testContainerContext,
  })),
}))

// Import the real services
import { Container } from '../../container/Container'
import { SentryService } from '../sentry/sentry.service'
import { SecretService } from '../services/secrets/secret.service'
import { LANG } from '../services/translations/translation.model'
import { translationService } from '../services/translations/translation.service'
import { getExpressTrpcApp } from './getExpressTrpcApp'

describe('getExpressTrpcApp - Simple Integration Test with Services', () => {
  let sentryService: SentryService
  let trpcRouter: any
  let expressRouter: Router
  let testPort: number
  let app: Express
  let server: http.Server | undefined
  let originalNodeEnv: string | undefined
  let container: Container<any, any>
  let tempDir: string
  let secretsPath: string
  let encryptionKey: string

  interface TenantMetadata {
    tenantId: string
    apiKey?: string
    locale?: string
  }

  // Create typed tRPC instance
  const t = initTRPC
    .context<{
      services?: any
    }>()
    .create()

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    process.setMaxListeners(20)
    vi.spyOn(process, 'exit').mockImplementation((() => {
      /* prevent process exit in tests */
    }) as any)

    // Create temp directory for test files
    tempDir = join(tmpdir(), `express-trpc-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    // Create language files in the expected location based on where the service is looking
    const langDir = join(__dirname, '../../../test/fixtures/lang')
    await fs.mkdir(langDir, { recursive: true })

    await fs.writeFile(
      join(langDir, 'en_us.json'),
      JSON.stringify({
        welcome: 'Welcome!',
        greeting: 'Hello {{name}}!',
        'user.created': 'User {{email}} created successfully',
      }),
    )

    await fs.writeFile(
      join(langDir, 'es_us.json'),
      JSON.stringify({
        welcome: '¡Bienvenido!',
        greeting: '¡Hola {{name}}!',
        'user.created': 'Usuario {{email}} creado exitosamente',
      }),
    )

    // Clear translation cache and reinitialize with new language files
    translationService.clearCacheAndReinitialize()

    // Create encrypted secrets file
    encryptionKey = 'test-encryption-key-32-chars-long'
    const secrets = {
      API_KEY: 'test-api-key-123',
      DB_PASSWORD: 'super-secret-password',
    }

    const encryptedSecrets = Security.encryptObject(secrets, encryptionKey)
    secretsPath = join(tempDir, 'secrets.json')
    await fs.writeFile(secretsPath, JSON.stringify(encryptedSecrets))
  })

  afterAll(async () => {
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      process.env.NODE_ENV = undefined
    }
    process.setMaxListeners(10)
    vi.restoreAllMocks()

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      const langDir = join(__dirname, '../../../test/fixtures/lang')
      await fs.rm(langDir, { recursive: true, force: true })
    } catch (_e) {
      // Ignore cleanup errors
    }
  })

  beforeEach(async () => {
    testPort = await Ports.nextAvailablePort(8000)

    // Create service factories - must be functions that return instances
    const factories = {
      secretService: (options: any) => new SecretService<any>(options),
      translationService: () => translationService,
      sentryService: (options: any) => new SentryService(options),
      customService: (name: string) => ({
        getName: () => `Custom Service: ${name}`,
      }),
    }

    // Create container with initializer
    container = new Container(
      factories,
      async (preload, meta: TenantMetadata) => {
        const secretService = preload.secretService(meta.tenantId, {
          provider: 'FILE',
          location: secretsPath,
          encryptionKey,
        })

        const sentryServiceInstance = preload.sentryService(meta.tenantId, {
          dsn: '',
          logger: console,
        })

        return {
          secretService,
          translationService: preload.translationService(meta.tenantId),
          sentryService: sentryServiceInstance,
          customService: preload.customService(
            meta.tenantId,
            `Service for ${meta.tenantId}`,
          ),
          tenant: meta,
        }
      },
    )

    // Bootstrap container and store context
    await container.bootstrap(
      { tenantId: 'test', locale: 'en_us' },
      async () => {
        testContainerContext = container.context
      },
    )

    // Create real SentryService
    sentryService = new SentryService({
      dsn: '',
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    })

    // Create TRPC router with direct service access
    trpcRouter = t.router({
      hello: t.procedure
        .input(z.object({ name: z.string() }))
        .query(({ input }) => {
          const lang = testContainerContext?.tenant?.locale || 'en_us'
          return translationService.translate(
            'greeting',
            { language: lang },
            { name: input.name },
          )
        }),

      getSecret: t.procedure
        .input(z.object({ key: z.string() }))
        .query(({ input }) => {
          const secrets =
            testContainerContext.secretService.loadSecretsFromFile()
          return { value: secrets[input.key] || null }
        }),

      translate: t.procedure
        .input(
          z.object({
            key: z.string(),
            lang: z.enum(['en_us', 'es_us']).optional(),
          }),
        )
        .query(({ input }) => {
          const lang = input.lang || 'en_us'
          return {
            translation: translationService.translate(
              input.key,
              { language: lang as LANG },
              {},
            ),
            locale: lang,
          }
        }),

      useContainerService: t.procedure.query(() => {
        return {
          customServiceName: testContainerContext.customService.getName(),
          hasSecretService: !!testContainerContext.secretService,
          hasTranslationService: !!testContainerContext.translationService,
        }
      }),
    })

    // Create express router
    expressRouter = Router()

    expressRouter.get('/test-services', (_req, res) => {
      res.json({
        hasContainer: !!container,
        hasContext: !!testContainerContext,
        customService:
          testContainerContext?.customService?.getName() || 'not available',
      })
    })

    // Reset environment variables
    process.env.NODE_ENV = 'test'
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001'
  })

  afterEach(async () => {
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')

    if (server && typeof server.close === 'function') {
      await new Promise<void>(resolve => {
        server!.close(() => resolve())
      })
    }

    process.env.ALLOWED_ORIGINS = undefined
    vi.clearAllMocks()
  })

  describe('Basic Service Integration', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
        features: { sentry: false },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should access container services in express routes', async () => {
      const res = await request(app).get('/test-services')

      expect(res.status).toBe(200)
      expect(res.body.hasContainer).toBe(true)
      expect(res.body.hasContext).toBe(true)
      expect(res.body.customService).toContain('Custom Service:')
    })

    it('should load secrets through TRPC', async () => {
      const res = await request(app).get(
        '/trpc/getSecret?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': { key: 'API_KEY' } })),
      )

      expect(res.status).toBe(200)
      expect(res.body[0].result.data.value).toBe('test-api-key-123')
    })

    it('should translate messages', async () => {
      const res = await request(app).get(
        '/trpc/translate?batch=1&input=' +
          encodeURIComponent(
            JSON.stringify({ '0': { key: 'welcome', lang: 'es_us' } }),
          ),
      )

      expect(res.status).toBe(200)
      expect(res.body[0].result.data.translation).toBe('¡Bienvenido!')
      expect(res.body[0].result.data.locale).toBe('es_us')
    })

    it('should use container services in TRPC', async () => {
      const res = await request(app).get(
        '/trpc/useContainerService?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': {} })),
      )

      expect(res.status).toBe(200)
      const data = res.body[0].result.data
      expect(data.customServiceName).toContain('Custom Service:')
      expect(data.hasSecretService).toBe(true)
      expect(data.hasTranslationService).toBe(true)
    })

    it('should handle translation with parameters', async () => {
      const res = await request(app).get(
        '/trpc/hello?batch=1&input=' +
          encodeURIComponent(JSON.stringify({ '0': { name: 'World' } })),
      )

      expect(res.status).toBe(200)
      expect(res.body[0].result.data).toBe('Hello World!')
    })
  })

  describe('OpenAPI Documentation', () => {
    beforeEach(async () => {
      const result = getExpressTrpcApp({
        trpcRouter,
        port: testPort,
        environment: 'test',
        expressResources: [expressRouter],
        sentryService,
        features: {
          sentry: false,
          openApiDocs: true,
        },
      })

      app = result.app
      server = app.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should serve OpenAPI JSON documentation', async () => {
      const res = await request(app).get('/openapi')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      expect(res.body).toHaveProperty('openapi')
      expect(res.body).toHaveProperty('info')
    })

    it('should serve Swagger UI', async () => {
      const res = await request(app).get('/api-docs/')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
    })
  })
})
