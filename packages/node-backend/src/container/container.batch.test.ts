// pnpm test:unit container.batch.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Container } from './Container'

// Enhanced mocks for cache with usage tracking and LRU behavior
vi.mock('./LruCache', () => {
  return {
    createServiceCache: vi.fn((max = 100) => {
      const map = new Map()
      const accessOrder = new Map()
      let accessCounter = 0

      return {
        get: (k: string) => {
          const value = map.get(k)
          if (value !== undefined) {
            accessOrder.set(k, ++accessCounter)
          }
          return value
        },
        set: (k: string, v: any) => {
          // Evict LRU item if at capacity
          if (map.size >= max && !map.has(k)) {
            let lruKey = null
            let lruTime = Infinity
            for (const [key, time] of accessOrder) {
              if (time < lruTime) {
                lruTime = time
                lruKey = key
              }
            }
            if (lruKey) {
              map.delete(lruKey)
              accessOrder.delete(lruKey)
            }
          }
          
          map.set(k, v)
          accessOrder.set(k, ++accessCounter)
          return map
        },
        delete: (k: string) => {
          accessOrder.delete(k)
          return map.delete(k)
        },
        values: () => map.values(),
        get size() { return map.size },
        clear: () => {
          map.clear()
          accessOrder.clear()
        },
      }
    }),
  }
})

describe('Container batch operations', () => {
  interface TestFactories {
    database: (connectionString: string) => { 
      connect: () => Promise<void>
      query: (sql: string) => Promise<any>
      dispose?: () => Promise<void>
    }
    api: {
      users: (db: any) => { 
        getAll: () => Promise<any[]>
        getById: (id: string) => Promise<any>
      }
      auth: (db: any, secret: string) => { 
        validate: (token: string) => Promise<boolean>
      }
    }
  }

  interface TenantMeta {
    id: string
    connectionString: string
    jwtSecret: string
  }

  const createMockDatabase = (connectionString: string) => ({
    connect: vi.fn(async () => {}),
    query: vi.fn(async (sql: string) => []),
    dispose: vi.fn(async () => {}),
  })

  const factories: TestFactories = {
    database: createMockDatabase,
    api: {
      users: (db: any) => ({
        getAll: vi.fn(async () => [{ id: '1', name: 'Test User' }]),
        getById: vi.fn(async (id: string) => ({ id, name: 'Test User' })),
      }),
      auth: (db: any, secret: string) => ({
        validate: vi.fn(async (token: string) => token === 'valid'),
      }),
    },
  }

  const initializer = async (preload: any, meta: TenantMeta) => {
    const db = preload.database(meta.id, meta.connectionString)
    await db.connect()
    
    return {
      database: db,
      api: {
        users: preload.api.users(meta.id, db),
        auth: preload.api.auth(meta.id, db, meta.jwtSecret),
      },
    }
  }

  let container: Container<TestFactories, TenantMeta>

  beforeEach(() => {
    vi.clearAllMocks()
    container = new Container(factories, initializer, { enableMetrics: true })
  })

  afterEach(async () => {
    await container.disposeAll()
  })

  describe('bootstrapBatch', () => {
    test('should bootstrap multiple tenants in parallel', async () => {
      const tenants: TenantMeta[] = [
        { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' },
        { id: 'tenant2', connectionString: 'db2', jwtSecret: 'secret2' },
        { id: 'tenant3', connectionString: 'db3', jwtSecret: 'secret3' },
      ]

      const results = await container.bootstrapBatch(
        tenants.map(metadata => ({ metadata }))
      )

      expect(results).toHaveLength(3)
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        expect(result.status).toBe('success')
        expect(result.metadata).toEqual(tenants[i])
        expect(result.instances).toBeDefined()
        expect(result.instances?.database).toBeDefined()
        expect(result.instances?.api.users).toBeDefined()
        expect(result.instances?.api.auth).toBeDefined()
        expect(result.metrics).toBeDefined()
        expect(result.metrics?.duration).toBeGreaterThanOrEqual(0)
      }

      const metrics = container.getMetrics()
      expect(metrics.batchOperations).toBe(3)
      expect(metrics.batchErrors).toBe(0)
    })

    test('should execute functions for each tenant', async () => {
      const tenants = [
        { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' },
        { id: 'tenant2', connectionString: 'db2', jwtSecret: 'secret2' },
      ]

      const functions = [
        vi.fn(async () => 'result1'),
        vi.fn(async () => 'result2'),
      ]

      const results = await container.bootstrapBatch([
        { metadata: tenants[0], fn: functions[0] },
        { metadata: tenants[1], fn: functions[1] },
      ])

      expect(results).toHaveLength(2)
      expect(functions[0]).toHaveBeenCalledOnce()
      expect(functions[1]).toHaveBeenCalledOnce()
      expect(results[0].result).toBe('result1')
      expect(results[1].result).toBe('result2')
    })

    test('should respect concurrency limit', async () => {
      const tenants = Array.from({ length: 10 }, (_, i) => ({
        id: `tenant${i}`,
        connectionString: `db${i}`,
        jwtSecret: `secret${i}`,
      }))

      let maxConcurrent = 0
      let currentConcurrent = 0

      const initializer = async (preload: any, meta: TenantMeta) => {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
        
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 50))
        
        const db = preload.database(meta.id, meta.connectionString)
        currentConcurrent--
        
        return { database: db }
      }

      const limitedContainer = new Container(
        factories,
        initializer,
        { enableMetrics: true }
      )

      await limitedContainer.bootstrapBatch(
        tenants.map(metadata => ({ metadata })),
        { concurrency: 3 }
      )

      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })

    test('should handle errors with continueOnError: true', async () => {
      const failingInitializer = async (preload: any, meta: TenantMeta) => {
        if (meta.id === 'tenant2') {
          throw new Error('Tenant 2 initialization failed')
        }
        const db = preload.database(meta.id, meta.connectionString)
        return { database: db }
      }

      const errorContainer = new Container(
        factories,
        failingInitializer,
        { enableMetrics: true, enableDiagnostics: false }
      )

      const tenants = [
        { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' },
        { id: 'tenant2', connectionString: 'db2', jwtSecret: 'secret2' },
        { id: 'tenant3', connectionString: 'db3', jwtSecret: 'secret3' },
      ]

      const results = await errorContainer.bootstrapBatch(
        tenants.map(metadata => ({ metadata })),
        { continueOnError: true }
      )

      expect(results).toHaveLength(3)
      expect(results[0].status).toBe('success')
      expect(results[1].status).toBe('error')
      expect(results[1].error?.message).toBe('Tenant 2 initialization failed')
      expect(results[2].status).toBe('success')

      const metrics = errorContainer.getMetrics()
      expect(metrics.batchOperations).toBe(2)
      expect(metrics.batchErrors).toBe(1)
    })

    test('should fail fast with continueOnError: false', async () => {
      const failingInitializer = async (preload: any, meta: TenantMeta) => {
        if (meta.id === 'tenant2') {
          throw new Error('Tenant 2 initialization failed')
        }
        const db = preload.database(meta.id, meta.connectionString)
        return { database: db }
      }

      const errorContainer = new Container(
        factories,
        failingInitializer,
        { enableDiagnostics: false }
      )

      const tenants = [
        { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' },
        { id: 'tenant2', connectionString: 'db2', jwtSecret: 'secret2' },
        { id: 'tenant3', connectionString: 'db3', jwtSecret: 'secret3' },
      ]

      await expect(
        errorContainer.bootstrapBatch(
          tenants.map(metadata => ({ metadata })),
          { continueOnError: false, concurrency: 1 }
        )
      ).rejects.toThrow('Tenant 2 initialization failed')
    })

    test('should handle timeout option', async () => {
      const slowInitializer = async (preload: any, meta: TenantMeta) => {
        if (meta.id === 'slow') {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        const db = preload.database(meta.id, meta.connectionString)
        return { database: db }
      }

      const timeoutContainer = new Container(
        factories,
        slowInitializer,
        { enableMetrics: true }
      )

      const results = await timeoutContainer.bootstrapBatch([
        { metadata: { id: 'fast', connectionString: 'db1', jwtSecret: 's1' } },
        { metadata: { id: 'slow', connectionString: 'db2', jwtSecret: 's2' } },
      ], {
        timeout: 100,
        continueOnError: true,
      })

      expect(results[0].status).toBe('success')
      expect(results[1].status).toBe('error')
      expect(results[1].error?.message).toContain('timeout')
    })

    test('should call progress callback', async () => {
      const progressCallback = vi.fn()
      const tenants = Array.from({ length: 5 }, (_, i) => ({
        id: `tenant${i}`,
        connectionString: `db${i}`,
        jwtSecret: `secret${i}`,
      }))

      await container.bootstrapBatch(
        tenants.map(metadata => ({ metadata })),
        { onProgress: progressCallback }
      )

      expect(progressCallback).toHaveBeenCalledTimes(5)
      for (let i = 1; i <= 5; i++) {
        expect(progressCallback).toHaveBeenCalledWith(
          i,
          5,
          expect.objectContaining({ id: expect.stringMatching(/^tenant\d$/) })
        )
      }
    })
  })

  describe('invalidateTenantBatch', () => {
    test('should invalidate multiple tenants', async () => {
      // First bootstrap some tenants
      const tenants = [
        { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' },
        { id: 'tenant2', connectionString: 'db2', jwtSecret: 'secret2' },
        { id: 'tenant3', connectionString: 'db3', jwtSecret: 'secret3' },
      ]

      await container.bootstrapBatch(
        tenants.map(metadata => ({ metadata }))
      )

      // Verify they are cached
      const stats1 = container.getCacheStats()
      expect(stats1.database.size).toBe(3)

      // Invalidate batch
      const result = await container.invalidateTenantBatch(
        ['tenant1', 'tenant2'],
        'Test invalidation'
      )

      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)

      // Verify cache was cleared for invalidated tenants
      const stats2 = container.getCacheStats()
      expect(stats2.database.size).toBe(1) // Only tenant3 remains
    })

    test('should handle errors during invalidation', async () => {
      // Mock a failing invalidation
      const spy = vi.spyOn(container as any, 'invalidateTenantLocally')
      spy.mockImplementationOnce(() => {})
      spy.mockImplementationOnce(() => {
        throw new Error('Invalidation failed')
      })
      spy.mockImplementationOnce(() => {})

      const result = await container.invalidateTenantBatch(
        ['tenant1', 'tenant2', 'tenant3'],
        'Test with error'
      )

      expect(result.total).toBe(3)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('tenant2')
      expect(result.errors[0].error.message).toBe('Invalidation failed')

      spy.mockRestore()
    })
  })

  describe('invalidateServiceBatch', () => {
    test('should invalidate multiple services', async () => {
      // Bootstrap a tenant to populate caches
      const tenant = { id: 'tenant1', connectionString: 'db1', jwtSecret: 'secret1' }
      await container.bootstrap(tenant)

      const result = await container.invalidateServiceBatch(
        ['database', 'api.users'],
        'Service update'
      )

      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
    })

    test('should handle distributed invalidation', async () => {
      const mockInvalidator = {
        invalidateService: vi.fn(async () => {}),
        on: vi.fn(),
      }

      const distContainer = new Container(
        factories,
        initializer,
        {
          enableDistributedInvalidation: true,
          distributedInvalidator: mockInvalidator as any,
        }
      )

      await distContainer.invalidateServiceBatch(
        ['service1', 'service2'],
        'Distributed test',
        true
      )

      expect(mockInvalidator.invalidateService).toHaveBeenCalledTimes(2)
      expect(mockInvalidator.invalidateService).toHaveBeenCalledWith('service1', 'Distributed test')
      expect(mockInvalidator.invalidateService).toHaveBeenCalledWith('service2', 'Distributed test')
    })
  })

  describe('performance metrics', () => {
    test('should track batch operation metrics', async () => {
      const tenants = Array.from({ length: 10 }, (_, i) => ({
        id: `tenant${i}`,
        connectionString: `db${i}`,
        jwtSecret: `secret${i}`,
      }))

      // Some will fail
      const mixedInitializer = async (preload: any, meta: TenantMeta) => {
        if (meta.id.endsWith('3') || meta.id.endsWith('7')) {
          throw new Error('Simulated failure')
        }
        const db = preload.database(meta.id, meta.connectionString)
        return { database: db }
      }

      const metricsContainer = new Container(
        factories,
        mixedInitializer,
        { enableMetrics: true }
      )

      await metricsContainer.bootstrapBatch(
        tenants.map(metadata => ({ metadata })),
        { continueOnError: true }
      )

      const metrics = metricsContainer.getMetrics()
      expect(metrics.batchOperations).toBe(8) // 10 total, 2 failed
      expect(metrics.batchErrors).toBe(2)

      const stats = metricsContainer.getPerformanceStats()
      expect(stats.batchSuccessRatio).toBeCloseTo(0.75) // 6/8 = 0.75
    })
  })

  describe('edge cases', () => {
    test('should handle empty batch', async () => {
      const results = await container.bootstrapBatch([])
      expect(results).toHaveLength(0)
    })

    test('should handle very large batches efficiently', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        metadata: {
          id: `tenant${i}`,
          connectionString: `db${i}`,
          jwtSecret: `secret${i}`,
        }
      }))

      const startTime = Date.now()
      const results = await container.bootstrapBatch(largeBatch, {
        concurrency: 20,
      })
      const duration = Date.now() - startTime

      expect(results).toHaveLength(100)
      expect(results.every(r => r.status === 'success')).toBe(true)
      
      // Should complete reasonably quickly with proper concurrency
      expect(duration).toBeLessThan(5000)
    })

    test('should handle mixed success and failure scenarios', async () => {
      const results = await container.bootstrapBatch([
        {
          metadata: { id: 'success1', connectionString: 'db1', jwtSecret: 's1' },
          fn: async () => 'ok',
        },
        {
          metadata: { id: 'fail1', connectionString: 'db2', jwtSecret: 's2' },
          fn: async () => { throw new Error('Failed') },
        },
        {
          metadata: { id: 'success2', connectionString: 'db3', jwtSecret: 's3' },
          fn: async () => 'ok',
        },
      ], {
        continueOnError: true,
      })

      const successes = results.filter(r => r.status === 'success')
      const failures = results.filter(r => r.status === 'error')

      expect(successes).toHaveLength(2)
      expect(failures).toHaveLength(1)
      expect(failures[0].metadata.id).toBe('fail1')
    })
  })
})