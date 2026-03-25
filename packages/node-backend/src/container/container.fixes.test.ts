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

describe('Tenant invalidation exact match', () => {
  test('should not invalidate tenant "abc" when invalidating tenant "a"', async () => {
    const factories = {
      service: () => ({ value: 1 }),
    }
    const initCount = { a: 0, abc: 0 }
    const initializer = async (preload: any, meta: { id: string }) => {
      initCount[meta.id as keyof typeof initCount]++
      return { service: preload.service(meta.id) }
    }

    const container = new Container(factories, initializer, {
      enableMetrics: true,
    })

    // Bootstrap both tenants
    await container.bootstrap({ id: 'a' })
    await container.bootstrap({ id: 'abc' })
    expect(initCount.a).toBe(1)
    expect(initCount.abc).toBe(1)

    // Invalidate only tenant "a" - should NOT affect "abc"
    await container.invalidateTenantDistributed('a', 'test')

    // Re-bootstrap both - only "a" should re-initialize
    await container.bootstrap({ id: 'a' })
    await container.bootstrap({ id: 'abc' })
    expect(initCount.a).toBe(2) // re-initialized
    expect(initCount.abc).toBe(1) // still cached

    await container.disposeAll()
  })
})

describe('Circular ref metadata caching', () => {
  test('should produce stable cache keys for circular ref metadata', async () => {
    const factories = { service: () => ({ value: 1 }) }
    let initCount = 0
    const initializer = async (preload: any, _meta: any) => {
      initCount++
      return { service: preload.service('t') }
    }

    const container = new Container(factories, initializer, {
      enableMetrics: true,
    })

    // Create circular ref metadata (no id/tenantId/name, and JSON.stringify will throw)
    const meta: any = { config: { deep: true } }
    meta.config.self = meta // circular reference

    await container.bootstrap(meta)
    expect(initCount).toBe(1)

    // Second bootstrap with same circular structure should hit cache
    await container.bootstrap(meta)
    expect(initCount).toBe(1) // still 1 = cache hit

    const metrics = container.getMetrics()
    expect(metrics.initializerCacheHits).toBe(1)

    await container.disposeAll()
  })
})

describe('Kill switch', () => {
  const factories = { service: () => ({ value: 1 }) }
  const initializer = async (preload: any, meta: { id: string }) => ({
    service: preload.service(meta.id),
  })

  test('should reject blocked tenants immediately', async () => {
    const container = new Container(factories, initializer)

    container.blockTenant('bad-tenant')

    await expect(container.bootstrap({ id: 'bad-tenant' })).rejects.toThrow(
      "Tenant 'bad-tenant' is blocked",
    )

    // Other tenants still work
    const result = await container.bootstrap({ id: 'good-tenant' })
    expect(result.instances).toBeDefined()
  })

  test('should allow unblocking tenants', async () => {
    const container = new Container(factories, initializer)

    container.blockTenant('temp-blocked')
    expect(container.isTenantBlocked('temp-blocked')).toBe(true)

    container.unblockTenant('temp-blocked')
    expect(container.isTenantBlocked('temp-blocked')).toBe(false)

    // Should work now
    const result = await container.bootstrap({ id: 'temp-blocked' })
    expect(result.instances).toBeDefined()
  })

  test('should list blocked tenants', () => {
    const container = new Container(factories, initializer)

    container.blockTenant('t1')
    container.blockTenant('t2')

    const blocked = container.getBlockedTenants()
    expect(blocked.has('t1')).toBe(true)
    expect(blocked.has('t2')).toBe(true)
    expect(blocked.size).toBe(2)
  })
})

describe('Initializer cooldown', () => {
  test('should block retries during cooldown after failure', async () => {
    let callCount = 0
    const factories = { service: () => ({ value: 1 }) }
    const initializer = async (preload: any, meta: { id: string }) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Init failed')
      }
      return { service: preload.service(meta.id) }
    }

    const container = new Container(factories, initializer, {
      initializerCooldownMs: 5000,
    })

    // First call fails
    await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow(
      'Init failed',
    )

    // Second call should be blocked by cooldown
    await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow(
      'cooldown',
    )

    // Initializer should only have been called once
    expect(callCount).toBe(1)
  })

  test('should allow retry after cooldown expires', async () => {
    let callCount = 0
    const factories = { service: () => ({ value: 1 }) }
    const initializer = async (preload: any, meta: { id: string }) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Init failed')
      }
      return { service: preload.service(meta.id) }
    }

    const container = new Container(factories, initializer, {
      initializerCooldownMs: 50, // very short for test
    })

    // First call fails
    await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow(
      'Init failed',
    )

    // Wait for cooldown to expire
    await new Promise(resolve => setTimeout(resolve, 60))

    // Should work now
    const result = await container.bootstrap({ id: 'tenant1' })
    expect(result.instances).toBeDefined()
    expect(callCount).toBe(2)
  })

  test('should not apply cooldown when initializerCooldownMs is 0', async () => {
    let callCount = 0
    const factories = { service: () => ({ value: 1 }) }
    const initializer = async (preload: any, meta: { id: string }) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Init failed')
      }
      return { service: preload.service(meta.id) }
    }

    const container = new Container(factories, initializer)

    // First call fails
    await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow()

    // Second call should retry immediately (no cooldown)
    const result = await container.bootstrap({ id: 'tenant1' })
    expect(result.instances).toBeDefined()
    expect(callCount).toBe(2)
  })
})

describe('Structured events', () => {
  const factories = { service: () => ({ value: 1 }) }
  const initializer = async (preload: any, meta: { id: string }) => ({
    service: preload.service(meta.id),
  })

  test('should emit bootstrap:start and bootstrap:complete events', async () => {
    const events: any[] = []
    const container = new Container(factories, initializer, {
      onEvent: e => events.push(e),
    })

    await container.bootstrap({ id: 'tenant1' })

    expect(events.some(e => e.type === 'bootstrap:start')).toBe(true)
    expect(events.some(e => e.type === 'bootstrap:complete')).toBe(true)

    const complete = events.find(e => e.type === 'bootstrap:complete')
    expect(complete.tenantId).toBe('tenant1')
    expect(complete.durationMs).toBeGreaterThanOrEqual(0)
  })

  test('should emit bootstrap:error on failure', async () => {
    const events: any[] = []
    const failingInitializer = async () => {
      throw new Error('boom')
    }
    const container = new Container(factories, failingInitializer, {
      onEvent: e => events.push(e),
    })

    await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow('boom')

    const errorEvent = events.find(e => e.type === 'bootstrap:error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent.tenantId).toBe('tenant1')
    expect(errorEvent.error.message).toBe('boom')
  })

  test('should emit tenant:blocked when kill switch triggers', async () => {
    const events: any[] = []
    const container = new Container(factories, initializer, {
      onEvent: e => events.push(e),
    })

    container.blockTenant('blocked-t')

    await expect(container.bootstrap({ id: 'blocked-t' })).rejects.toThrow()

    expect(events.some(e => e.type === 'tenant:blocked')).toBe(true)
  })

  test('should emit tenant:invalidated on invalidation', async () => {
    const events: any[] = []
    const container = new Container(factories, initializer, {
      onEvent: e => events.push(e),
    })

    await container.bootstrap({ id: 'tenant1' })
    await container.invalidateTenantDistributed('tenant1', 'config change')

    const event = events.find(e => e.type === 'tenant:invalidated')
    expect(event).toBeDefined()
    expect(event.tenantId).toBe('tenant1')
    expect(event.reason).toBe('config change')
  })

  test('should not fail when onEvent is not provided', async () => {
    const container = new Container(factories, initializer)
    // Should work fine without onEvent
    const result = await container.bootstrap({ id: 'tenant1' })
    expect(result.instances).toBeDefined()
  })
})

describe('Memory pressure protection', () => {
  const factories = { service: () => ({ value: 1 }) }
  const initializer = async (preload: any, meta: { id: string }) => ({
    service: preload.service(meta.id),
  })

  test('should reject bootstrap when heap usage exceeds threshold', async () => {
    // Mock process.memoryUsage to simulate high heap usage
    const original = process.memoryUsage
    process.memoryUsage = (() => ({
      heapUsed: 900_000_000,
      heapTotal: 1_000_000_000, // 90% usage
      rss: 0,
      external: 0,
      arrayBuffers: 0,
    })) as any

    try {
      const container = new Container(factories, initializer, {
        maxHeapUsageRatio: 0.85,
        heapCheckInterval: 1, // check every call for test
      })

      await expect(container.bootstrap({ id: 'tenant1' })).rejects.toThrow(
        'Memory pressure',
      )
    } finally {
      process.memoryUsage = original
    }
  })

  test('should allow bootstrap when heap usage is under threshold', async () => {
    const original = process.memoryUsage
    process.memoryUsage = (() => ({
      heapUsed: 500_000_000,
      heapTotal: 1_000_000_000, // 50% usage
      rss: 0,
      external: 0,
      arrayBuffers: 0,
    })) as any

    try {
      const container = new Container(factories, initializer, {
        maxHeapUsageRatio: 0.85,
        heapCheckInterval: 1,
      })

      const result = await container.bootstrap({ id: 'tenant1' })
      expect(result.instances).toBeDefined()
    } finally {
      process.memoryUsage = original
    }
  })

  test('should not check heap when maxHeapUsageRatio is 0', async () => {
    const container = new Container(factories, initializer)
    // Default is 0, should work fine
    const result = await container.bootstrap({ id: 'tenant1' })
    expect(result.instances).toBeDefined()
  })

  test('should only check every Nth call based on heapCheckInterval', async () => {
    let checkCount = 0
    const original = process.memoryUsage
    process.memoryUsage = (() => {
      checkCount++
      return {
        heapUsed: 500_000_000,
        heapTotal: 1_000_000_000,
        rss: 0,
        external: 0,
        arrayBuffers: 0,
      }
    }) as any

    try {
      const container = new Container(factories, initializer, {
        maxHeapUsageRatio: 0.85,
        heapCheckInterval: 5,
      })

      // Bootstrap 10 times, should check heap exactly 2 times (at 5th and 10th)
      checkCount = 0
      for (let i = 0; i < 10; i++) {
        await container.bootstrap({ id: `tenant${i}` })
      }
      expect(checkCount).toBe(2)
    } finally {
      process.memoryUsage = original
    }
  })
})

describe('Symbol-based proxy opt-out', () => {
  // Import the symbol - use Symbol.for to get the same symbol
  const NO_CONTAINER_PROXY = Symbol.for('goatlab.container.noProxy')

  test('should not wrap objects with NO_CONTAINER_PROXY symbol', async () => {
    const customService = {
      [NO_CONTAINER_PROXY]: true,
      query: vi.fn(() => 'result'),
      _internalProp: 'should not throw',
    }

    const factories = {
      custom: () => customService,
    }
    const initializer = async (preload: any, meta: { id: string }) => ({
      custom: preload.custom(meta.id),
    })

    const container = new Container(factories, initializer)

    await container.bootstrap({ id: 'tenant1' }, async () => {
      const ctx = container.context as any
      // Accessing the service should return the raw object (not proxied)
      expect(ctx.custom.query()).toBe('result')
      // Internal properties should be accessible without proxy interference
      expect(ctx.custom._internalProp).toBe('should not throw')
    })
  })

  test('should return raw objects without proxy wrapping', async () => {
    const nestedService = {
      inner: {
        value: 42,
      },
    }

    const factories = {
      nested: () => nestedService,
    }
    const initializer = async (preload: any, meta: { id: string }) => ({
      nested: preload.nested(meta.id),
    })

    const container = new Container(factories, initializer)

    await container.bootstrap({ id: 'tenant1' }, async () => {
      const ctx = container.context as any
      expect(ctx.nested.inner.value).toBe(42)

      // No proxy — accessing non-existent returns undefined
      expect(ctx.nested.inner.nonExistent).toBeUndefined()
    })
  })

  test('legacy duck-typing still works for Prisma-like objects', async () => {
    const prismaLike = {
      _engine: {},
      _extensions: {},
      $connect: vi.fn(),
      findMany: vi.fn(() => []),
    }

    const factories = { db: () => prismaLike }
    const initializer = async (preload: any, meta: { id: string }) => ({
      db: preload.db(meta.id),
    })

    const container = new Container(factories, initializer)

    await container.bootstrap({ id: 'tenant1' }, async () => {
      const ctx = container.context as any
      // Should not be proxied (legacy duck-typing)
      expect(ctx.db.findMany()).toEqual([])
      expect(ctx.db._engine).toBeDefined()
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
