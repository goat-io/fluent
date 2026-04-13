// npx vitest run ./packages/node-backend/src/server/bootstraps/__tests__/getExpressTrpcApp.test.ts

import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { ExpressTrpcAppConfig, getDefaultConfig } from '../ExpressTrpcAppConfig'

// Create a simple TRPC router for testing
const t = initTRPC.create()
const testRouter = t.router({
  hello: t.procedure.query(() => 'world'),
})

describe('getExpressTrpcApp configuration', () => {
  describe('getDefaultConfig', () => {
    it('should work with minimal configuration (just trpcRouter)', () => {
      const minimalConfig: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
      }

      const result = getDefaultConfig(minimalConfig as ExpressTrpcAppConfig)

      // Check that defaults are applied
      expect(result.appName).toBe('@goatlab/node-backend')
      expect(result.appVersion).toBeDefined() // Version from package.json
      expect(result.port).toBe(3000)
      expect(result.environment).toBe('local')
      expect(result.baseUrl).toBe('http://localhost:3000')

      // Check nested defaults
      expect(result.features?.openApiDocs).toBe(false)
      expect(result.features?.sentry).toBe(false) // local env
      expect(result.features?.trustProxy).toBe(true)
      expect(result.features?.etag).toBe('strong')

      expect(result.security?.cors?.credentials).toBe(true)
      expect(result.security?.cors?.maxAge).toBe(86400)
      expect(result.security?.cors?.allowedOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ])

      expect(result.security?.rateLimit?.global?.windowMs).toBe(15 * 60 * 1000)
      expect(result.security?.rateLimit?.global?.max).toBe(100)
    })

    it('should properly merge nested objects without replacing other defaults', () => {
      const partialConfig: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        security: {
          cors: {
            maxAge: 7200, // Only override maxAge
          },
        },
      }

      const result = getDefaultConfig(partialConfig as ExpressTrpcAppConfig)

      // Check that the override is applied
      expect(result.security?.cors?.maxAge).toBe(7200)

      // Check that other CORS defaults are preserved
      expect(result.security?.cors?.credentials).toBe(true)
      expect(result.security?.cors?.allowedOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ])

      // Check that other security defaults are preserved
      expect(result.security?.rateLimit?.global?.windowMs).toBe(15 * 60 * 1000)
      expect(result.security?.helmet?.contentSecurityPolicy).toBe(false) // local env
    })

    it('should allow arrays to be completely replaced', () => {
      const configWithArrays: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        security: {
          cors: {
            allowedOrigins: ['https://example.com', 'https://app.example.com'],
          },
        },
      }

      const result = getDefaultConfig(configWithArrays as ExpressTrpcAppConfig)

      // Check that the array is replaced, not merged
      expect(result.security?.cors?.allowedOrigins).toEqual([
        'https://example.com',
        'https://app.example.com',
      ])
      expect(result.security?.cors?.allowedOrigins).not.toContain(
        'http://localhost:3000',
      )
    })

    it('should apply production defaults when environment is prod', () => {
      const prodConfig: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        environment: 'prod',
      }

      const result = getDefaultConfig(prodConfig as ExpressTrpcAppConfig)

      expect(result.features?.sentry).toBe(true)
      expect(result.security?.cors?.allowedOrigins).toEqual([]) // No default origins in prod
      expect(result.security?.helmet?.contentSecurityPolicy).toBe(true)
      expect(result.security?.helmet?.crossOriginEmbedderPolicy).toBe(true)
      expect(
        result.performance?.memoryMonitoring?.enableGarbageCollection,
      ).toBe(true)
      expect(result.performance?.memoryMonitoring?.addHeaders).toBe(false)
    })

    it('should handle deep nested overrides correctly', () => {
      const deepConfig: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        performance: {
          compression: {
            level: 9, // Override just the level
          },
          memoryMonitoring: {
            warningThreshold: 85, // Override just the warning threshold
          },
        },
      }

      const result = getDefaultConfig(deepConfig as ExpressTrpcAppConfig)

      // Check overrides
      expect(result.performance?.compression?.level).toBe(9)
      expect(result.performance?.memoryMonitoring?.warningThreshold).toBe(85)

      // Check other defaults are preserved
      expect(result.performance?.compression?.enabled).toBe(true)
      expect(result.performance?.compression?.threshold).toBe(1024)
      expect(result.performance?.compression?.chunkSize).toBe(16 * 1024)
      expect(result.performance?.compression?.memLevel).toBe(8)

      expect(result.performance?.memoryMonitoring?.enabled).toBe(true)
      expect(result.performance?.memoryMonitoring?.criticalThreshold).toBe(95)
      expect(result.performance?.memoryMonitoring?.monitorInterval).toBe(30000)
    })

    it('should calculate baseUrl from port if not provided', () => {
      const configWithPort: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        port: 8080,
      }

      const result = getDefaultConfig(configWithPort as ExpressTrpcAppConfig)

      expect(result.baseUrl).toBe('http://localhost:8080')
    })

    it('should use provided baseUrl over calculated one', () => {
      const configWithBaseUrl: Partial<ExpressTrpcAppConfig> = {
        trpcRouter: testRouter,
        port: 8080,
        baseUrl: 'https://api.example.com',
      }

      const result = getDefaultConfig(configWithBaseUrl as ExpressTrpcAppConfig)

      expect(result.baseUrl).toBe('https://api.example.com')
    })
  })
})
