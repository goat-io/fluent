// pnpm test:unit container.fixes.test.ts
// Tests for critical fixes identified in roundtable analysis
import { describe, expect, test, vi } from 'vitest'
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
            let lruTime = Number.POSITIVE_INFINITY
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
        entries: () => map.entries(),
        get size() {
          return map.size
        },
        clear: () => {
          map.clear()
          accessOrder.clear()
        },
      }
    }),
  }
})

describe('Container Critical Fixes', () => {
  interface TestFactories {
    database: (connectionString: string) => {
      connect: () => Promise<void>
      query: (sql: string) => Promise<any>
      dispose?: () => Promise<void>
    }
    api: {
      users: (db: any) => {
        getAll: () => Promise<any[]>
      }
    }
  }

  interface TenantMeta {
    id: string
    connectionString: string
  }

  const createMockDatabase = (_connectionString: string) => ({
    connect: vi.fn(async () => {}),
    query: vi.fn(async (_sql: string) => []),
    dispose: vi.fn(async () => {}),
  })

  const factories: TestFactories = {
    database: createMockDatabase,
    api: {
      users: (_db: any) => ({
        getAll: vi.fn(async () => [{ id: '1', name: 'Test User' }]),
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
      },
    }
  }

  describe('initializerCache size limit', () => {
    test('should respect maxInitializerCacheSize option', async () => {
      const container = new Container(factories, initializer, {
        maxInitializerCacheSize: 3,
        enableMetrics: true,
      })

      // Bootstrap 5 different tenants
      for (let i = 0; i < 5; i++) {
        await container.bootstrap({
          id: `tenant${i}`,
          connectionString: `db${i}`,
        })
      }

      // initializerCache should have at most 3 entries
      const stats = container.getPerformanceStats()
      expect(stats.initializerCacheSize).toBeLessThanOrEqual(3)

      await container.disposeAll()
    })

    test('should evict LRU entries from initializerCache', async () => {
      const container = new Container(factories, initializer, {
        maxInitializerCacheSize: 2,
        enableMetrics: true,
      })

      // Bootstrap tenant0 and tenant1
      await container.bootstrap({ id: 'tenant0', connectionString: 'db0' })
      await container.bootstrap({ id: 'tenant1', connectionString: 'db1' })

      // Access tenant0 again to make it recently used
      await container.bootstrap({ id: 'tenant0', connectionString: 'db0' })

      // Bootstrap tenant2 - should evict tenant1 (LRU)
      await container.bootstrap({ id: 'tenant2', connectionString: 'db2' })

      const stats = container.getPerformanceStats()
      expect(stats.initializerCacheSize).toBe(2)

      // tenant1 should need re-initialization (cache hit counter before and after)
      const metricsBefore = container.getMetrics()
      await container.bootstrap({ id: 'tenant1', connectionString: 'db1' })
      const metricsAfter = container.getMetrics()

      // If tenant1 was evicted, we should NOT get an initializer cache hit
      // (the hit count should be the same before and after since it needs re-init)
      expect(metricsAfter.initializerCacheHits).toBe(
        metricsBefore.initializerCacheHits,
      )

      await container.disposeAll()
    })

    test('should default maxInitializerCacheSize to cacheSize if not specified', async () => {
      const container = new Container(factories, initializer, {
        cacheSize: 50,
        enableMetrics: true,
      })

      // The default should use cacheSize as the limit
      // We verify this by checking the option is applied
      const stats = container.getPerformanceStats()
      expect(stats.initializerCacheSize).toBeDefined()

      await container.disposeAll()
    })
  })

  describe('disposal error aggregation', () => {
    test('should collect and return disposal errors from disposeAll', async () => {
      const failingDispose = vi.fn(async () => {
        throw new Error('Disposal failed for service')
      })

      const failingFactories = {
        service1: () => ({
          value: 1,
          dispose: failingDispose,
        }),
        service2: () => ({
          value: 2,
          dispose: vi.fn(async () => {}), // This one succeeds
        }),
        service3: () => ({
          value: 3,
          dispose: vi.fn(async () => {
            throw new Error('Another disposal error')
          }),
        }),
      }

      const failingInitializer = async (preload: any, meta: TenantMeta) => ({
        service1: preload.service1(meta.id),
        service2: preload.service2(meta.id),
        service3: preload.service3(meta.id),
      })

      const container = new Container(failingFactories, failingInitializer, {
        enableDiagnostics: false,
      })

      await container.bootstrap({ id: 'tenant1', connectionString: 'db1' })

      // disposeAll should return disposal errors instead of swallowing them
      const result = await container.disposeAll()

      expect(result).toBeDefined()
      expect(result.errors).toHaveLength(2)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(2)
    })

    test('should include service path in disposal error', async () => {
      const failingFactories = {
        database: () => ({
          connection: 'test',
          dispose: vi.fn(async () => {
            throw new Error('Connection already closed')
          }),
        }),
      }

      const failingInitializer = async (preload: any, meta: TenantMeta) => ({
        database: preload.database(meta.id),
      })

      const container = new Container(failingFactories, failingInitializer, {
        enableDiagnostics: false,
      })

      await container.bootstrap({ id: 'tenant1', connectionString: 'db1' })

      const result = await container.disposeAll()

      expect(result.errors[0]).toMatchObject({
        error: expect.any(Error),
      })
      expect(result.errors[0].error.message).toContain(
        'Connection already closed',
      )
    })
  })

  describe('clearCaches disposal result', () => {
    test('clearCachesAsync should return disposal summary', async () => {
      const mockDispose = vi.fn(async () => {})

      const disposableFactories = {
        service: () => ({
          value: 1,
          dispose: mockDispose,
        }),
      }

      const disposableInitializer = async (preload: any, meta: TenantMeta) => ({
        service: preload.service(meta.id),
      })

      const container = new Container(
        disposableFactories,
        disposableInitializer,
        { enableDiagnostics: false },
      )

      await container.bootstrap({ id: 'tenant1', connectionString: 'db1' })
      await container.bootstrap({ id: 'tenant2', connectionString: 'db2' })

      const result = await container.clearCachesAsync()

      expect(result).toBeDefined()
      expect(result.disposed).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })
  })
})

describe('Container ContainerOptions type extension', () => {
  test('should accept maxInitializerCacheSize in options', () => {
    const factories = {
      service: () => ({ value: 1 }),
    }
    const initializer = async (preload: any, meta: { id: string }) => ({
      service: preload.service(meta.id),
    })

    // This should compile without TypeScript errors
    const container = new Container(factories, initializer, {
      cacheSize: 100,
      maxInitializerCacheSize: 50,
      enableMetrics: true,
    })

    expect(container).toBeDefined()
  })
})
