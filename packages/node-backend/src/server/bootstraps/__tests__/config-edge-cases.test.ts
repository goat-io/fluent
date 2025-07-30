// npx vitest run ./packages/node-backend/src/server/bootstraps/__tests__/config-edge-cases.test.ts

import { describe, it, expect } from 'vitest'
import { initTRPC } from '@trpc/server'
import { ExpressTrpcAppConfigInput, getDefaultConfig } from '../ExpressTrpcAppConfig'

// Create a simple TRPC router for testing
const t = initTRPC.create()
const testRouter = t.router({
  hello: t.procedure.query(() => 'world')
})

describe('getDefaultConfig edge cases', () => {
  it('should handle null values correctly', () => {
    const configWithNull: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      logger: null as any // Explicitly setting null
    }
    
    const result = getDefaultConfig(configWithNull)
    
    // Null should replace the default value
    expect(result.logger).toBe(null)
  })
  
  it('should handle undefined values by keeping defaults', () => {
    const configWithUndefined: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      appName: undefined, // Explicitly undefined
      security: {
        cors: {
          credentials: undefined // Nested undefined
        }
      }
    }
    
    const result = getDefaultConfig(configWithUndefined)
    
    // Undefined values should not override defaults
    expect(result.appName).toBe('@goatlab/node-backend')
    expect(result.security.cors.credentials).toBe(true)
  })
  
  it('should handle empty objects correctly', () => {
    const configWithEmptyObjects: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      features: {}, // Empty object should preserve defaults
      security: {
        cors: {} // Empty nested object
      }
    }
    
    const result = getDefaultConfig(configWithEmptyObjects)
    
    // Empty objects should preserve all defaults
    expect(result.features.openApiDocs).toBe(false)
    expect(result.features.trustProxy).toBe(true)
    expect(result.security.cors.credentials).toBe(true)
    expect(result.security.cors.maxAge).toBe(86400)
  })
  
  it('should handle false boolean values correctly', () => {
    const configWithFalse: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      features: {
        trustProxy: false, // Explicitly false
        openApiDocs: false
      },
      performance: {
        compression: {
          enabled: false // Disable compression
        },
        memoryMonitoring: {
          enabled: false // Disable memory monitoring
        }
      }
    }
    
    const result = getDefaultConfig(configWithFalse)
    
    // False values should be preserved
    expect(result.features.trustProxy).toBe(false)
    expect(result.features.openApiDocs).toBe(false)
    expect(result.performance.compression.enabled).toBe(false)
    expect(result.performance.memoryMonitoring.enabled).toBe(false)
  })
  
  it('should handle complex nested overrides without affecting siblings', () => {
    const complexConfig: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      security: {
        rateLimit: {
          global: {
            max: 200 // Override only max, not windowMs
          }
          // auth and api should retain their defaults
        }
      }
    }
    
    const result = getDefaultConfig(complexConfig)
    
    // Check the override
    expect(result.security.rateLimit.global.max).toBe(200)
    expect(result.security.rateLimit.global.windowMs).toBe(15 * 60 * 1000)
    
    // Check siblings are preserved
    expect(result.security.rateLimit.auth.max).toBe(5)
    expect(result.security.rateLimit.auth.windowMs).toBe(15 * 60 * 1000)
    expect(result.security.rateLimit.api.max).toBe(100)
    
    // Check other security settings are preserved
    expect(result.security.cors.credentials).toBe(true)
    expect(result.security.requestTimeout).toBe(30000)
  })
  
  it('should handle array replacement correctly', () => {
    const configWithArrays: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      expressResources: [1, 2, 3] as any, // Replace default empty array
      bodyParsing: {
        json: {
          type: ['application/custom'] // Replace default type array
        }
      }
    }
    
    const result = getDefaultConfig(configWithArrays)
    
    // Arrays should be replaced, not merged
    expect(result.expressResources).toEqual([1, 2, 3])
    expect(result.bodyParsing.json.type).toEqual(['application/custom'])
    expect(result.bodyParsing.json.type).not.toContain('application/json')
  })
  
  it('should calculate correct defaults based on environment', () => {
    // Test development environment
    const devConfig: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      environment: 'dev'
    }
    
    const devResult = getDefaultConfig(devConfig)
    expect(devResult.features.sentry).toBe(false)
    expect(devResult.security.helmet.crossOriginEmbedderPolicy).toBe(false)
    expect(devResult.performance.memoryMonitoring.addHeaders).toBe(true)
    
    // Test staging environment
    const stagingConfig: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      environment: 'staging'
    }
    
    const stagingResult = getDefaultConfig(stagingConfig)
    expect(stagingResult.features.sentry).toBe(false)
    expect(stagingResult.security.helmet.crossOriginEmbedderPolicy).toBe(true)
    expect(stagingResult.performance.memoryMonitoring.enableGarbageCollection).toBe(false)
  })
  
  it('should handle custom handlers and functions correctly', () => {
    const customHandler = () => Promise.resolve({ custom: true })
    const shutdownHandler = () => Promise.resolve()
    const errorHandler = (error: Error) => console.error(error)
    
    const configWithHandlers: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      healthCheck: {
        customChecks: customHandler
      },
      processManagement: {
        gracefulShutdown: {
          onShutdown: shutdownHandler
        },
        uncaughtException: {
          handler: errorHandler
        }
      }
    }
    
    const result = getDefaultConfig(configWithHandlers)
    
    // Functions should be preserved
    expect(result.healthCheck.customChecks).toBe(customHandler)
    expect(result.processManagement.gracefulShutdown.onShutdown).toBe(shutdownHandler)
    expect(result.processManagement.uncaughtException?.handler).toBe(errorHandler)
    
    // Other defaults should still be present
    expect(result.healthCheck.path).toBe('/health')
    expect(result.processManagement.gracefulShutdown.enabled).toBe(true)
    expect(result.processManagement.gracefulShutdown.timeout).toBe(30000)
  })
  
  it('should preserve object type values in security configuration', () => {
    const customCSP = {
      directives: {
        defaultSrc: ["'self'", 'https://trusted.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://scripts.com']
      }
    }
    
    const configWithObjectValues: ExpressTrpcAppConfigInput = {
      trpcRouter: testRouter,
      security: {
        helmet: {
          contentSecurityPolicy: customCSP // Object value instead of boolean
        }
      }
    }
    
    const result = getDefaultConfig(configWithObjectValues)
    
    expect(result.security.helmet.contentSecurityPolicy).toEqual(customCSP)
    expect(result.security.helmet.crossOriginEmbedderPolicy).toBe(false) // local env default
  })
})