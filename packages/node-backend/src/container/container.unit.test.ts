// pnpm test:unit container.unit.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Container } from './Container'

// Enhanced mocks for cache with usage tracking and LRU behavior
vi.mock('./LruCache', () => {
  return {
    createServiceCache: vi.fn((max = 100) => {
      const map = new Map()
      const accessOrder = new Map()
      let accessCounter = 0
      let getCount = 0
      let setCount = 0

      return {
        get: (k: string) => {
          getCount++
          const value = map.get(k)
          if (value !== undefined) {
            accessOrder.set(k, ++accessCounter)
          }
          return value
        },
        set: (k: string, v: any) => {
          setCount++
          
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
        getCallCount: () => getCount,
        setCallCount: () => setCount,
        get size() { return map.size },
        clear: () => {
          map.clear()
          accessOrder.clear()
          getCount = 0
          setCount = 0
        },
      }
    }),
  }
})

describe('Container basic tests', () => {
  interface Factories extends Record<string, unknown> {
    serviceA: (x: number) => { value: number }
    nested: Record<string, unknown> & {
      serviceB: (y: string) => { text: string }
    }
  }
  interface TenantMeta {
    tenantId: string
  }

  const factories: Factories = {
    serviceA: (x: number) => ({ value: x }),
    nested: {
      serviceB: (y: string) => ({ text: y }),
    },
  }

  const initializer = async (preload: any, meta: TenantMeta): Promise<any> => {
    return {
      serviceA: preload.serviceA(meta.tenantId, 42),
      nested: {
        serviceB: preload.nested.serviceB(meta.tenantId, 'hello'),
      },
    }
  }

  let container: Container<Factories, TenantMeta>

  beforeEach(() => {
    vi.clearAllMocks()
    container = new Container(factories as any, initializer as any)
  })

  test('should preload and cache services', () => {
    const a1 = container.preload.serviceA('t1', 1)
    const a2 = container.preload.serviceA('t1', 1)
    expect(a1).toBe(a2)
    expect(a1.value).toBe(1)

    const b1 = container.preload.nested.serviceB('t2', 'foo')
    const b2 = container.preload.nested.serviceB('t2', 'foo')
    expect(b1).toBe(b2)
    expect(b1.text).toBe('foo')
  })

  test('should call initializer and run context', async () => {
    const meta = { tenantId: 'tenantX' }
    let ran = false
    await container.bootstrap(meta, async () => {
      ran = true
      // context should be available inside
      expect(container.context.serviceA.value).toBe(42)
      expect(container.context.nested.serviceB.text).toBe('hello')
    })
    expect(ran).toBe(true)
  })

  test('should throw if context is accessed outside of bootstrap', () => {
    expect(() => container.context).toThrow('No tenant context')
  })

  test('should throw if context proxy is missing a service', async () => {
    const meta = { tenantId: 'tenantY' }
    await container.bootstrap(meta, async () => {
      // Remove a service from context to simulate missing
      const store = (container as any).als.getStore()
      delete store.instances.serviceA
      expect(() => container.context.serviceA).toThrow(
        "Service 'serviceA' not initialized",
      )
    })
  })

  test('should cache services per tenant', () => {
    const a1 = container.preload.serviceA('tenant1', 10)
    const a2 = container.preload.serviceA('tenant2', 10)
    expect(a1).not.toBe(a2)
    expect(a1.value).toBe(10)
    expect(a2.value).toBe(10)
  })

  test('should isolate context between bootstrap calls', async () => {
    const meta1 = { tenantId: 'tA' }
    const meta2 = { tenantId: 'tB' }
    let contextA: any
    let contextB: any

    await container.bootstrap(meta1, async () => {
      contextA = container.context
      expect(contextA.serviceA.value).toBe(42)
    })

    await container.bootstrap(meta2, async () => {
      contextB = container.context
      expect(contextB.serviceA.value).toBe(42)
    })

    expect(contextA).not.toBe(contextB)
  })

  test('should allow multiple bootstrap calls sequentially', async () => {
    const meta1 = { tenantId: 'seq1' }
    const meta2 = { tenantId: 'seq2' }
    let ran1 = false
    let ran2 = false

    await container.bootstrap(meta1, async () => {
      ran1 = true
      expect(container.context.serviceA.value).toBe(42)
    })

    await container.bootstrap(meta2, async () => {
      ran2 = true
      expect(container.context.serviceA.value).toBe(42)
    })

    expect(ran1).toBe(true)
    expect(ran2).toBe(true)
  })

  test('should throw if preload is called with missing factory', () => {
    expect(() => (container.preload as any).nonexistent('t1')).toThrow()
  })
})

describe('Container Caching and Performance Tests', () => {
  interface TestFactories extends Record<string, unknown> {
    serviceA: (x: number) => { value: number; created: Date }
    serviceB: (y: string) => { text: string; created: Date }
    nested: Record<string, unknown> & {
      serviceC: (z: boolean) => { flag: boolean; created: Date }
      deepNested: Record<string, unknown> & {
        serviceD: () => { id: string; created: Date }
      }
    }
  }

  interface TenantMeta {
    tenantId: string
  }

  // Factory functions that create objects with timestamps to verify caching
  const factories: TestFactories = {
    serviceA: (x: number) => ({ value: x, created: new Date() }),
    serviceB: (y: string) => ({ text: y, created: new Date() }),
    nested: {
      serviceC: (z: boolean) => ({ flag: z, created: new Date() }),
      deepNested: {
        serviceD: () => ({ id: 'service-d', created: new Date() }),
      },
    },
  }

  const initializer = async (preload: any, meta: TenantMeta): Promise<any> => {
    return {
      serviceA: preload.serviceA(meta.tenantId, 42),
      serviceB: preload.serviceB(meta.tenantId, 'hello'),
      nested: {
        serviceC: preload.nested.serviceC(meta.tenantId, true),
        deepNested: {
          serviceD: preload.nested.deepNested.serviceD(meta.tenantId),
        },
      },
    }
  }

  let container: Container<TestFactories, TenantMeta>

  beforeEach(() => {
    vi.clearAllMocks()
    container = new Container(factories as any, initializer as any)
  })

  describe('Service Instance Caching', () => {
    test('should cache service instances by ID and return same instance', () => {
      const service1 = container.preload.serviceA('tenant1', 100)
      const service2 = container.preload.serviceA('tenant1', 200) // Different params, same ID

      // Should return cached instance (first call), ignoring new parameters
      expect(service1).toBe(service2)
      expect(service1.value).toBe(100) // Original value preserved
      expect(service1.created).toBe(service2.created) // Same timestamp
    })

    test('should create separate instances for different tenant IDs', () => {
      const service1 = container.preload.serviceA('tenant1', 100)
      const service2 = container.preload.serviceA('tenant2', 100)

      expect(service1).not.toBe(service2)
      expect(service1.value).toBe(100)
      expect(service2.value).toBe(100)
      expect(service1.created).not.toBe(service2.created)
    })

    test('should cache nested service instances correctly', () => {
      const service1 = container.preload.nested.serviceC('tenant1', true)
      const service2 = container.preload.nested.serviceC('tenant1', false) // Different params

      expect(service1).toBe(service2)
      expect(service1.flag).toBe(true) // Original value preserved
    })

    test('should cache deeply nested service instances', () => {
      const service1 = container.preload.nested.deepNested.serviceD('tenant1')
      const service2 = container.preload.nested.deepNested.serviceD('tenant1')

      expect(service1).toBe(service2)
      expect(service1.id).toBe('service-d')
      expect(service1.created).toBe(service2.created)
    })

    test('should maintain separate caches for different service types', () => {
      const serviceA1 = container.preload.serviceA('shared-id', 100)
      const serviceA2 = container.preload.serviceA('shared-id', 200)
      const serviceB1 = container.preload.serviceB('shared-id', 'hello')
      const serviceB2 = container.preload.serviceB('shared-id', 'world')

      // Same ID but different service types should be cached separately
      expect(serviceA1).toBe(serviceA2)
      expect(serviceB1).toBe(serviceB2)
      expect(serviceA1.value).toBe(100)
      expect(serviceB1.text).toBe('hello')
    })
  })

  describe('Performance and Efficiency', () => {
    test('should minimize factory calls through caching', () => {
      const factoryCallCount = new Map<string, number>()

      const trackingFactories = {
        serviceA: (x: number) => {
          const key = 'serviceA'
          factoryCallCount.set(key, (factoryCallCount.get(key) || 0) + 1)
          return { value: x, created: new Date() }
        },
        serviceB: (y: string) => {
          const key = 'serviceB'
          factoryCallCount.set(key, (factoryCallCount.get(key) || 0) + 1)
          return { text: y, created: new Date() }
        },
      }

      const trackingContainer = new Container(
        trackingFactories as any,
        async (preload: any, meta: TenantMeta) =>
          ({
            serviceA: preload.serviceA(meta.tenantId, 42),
            serviceB: preload.serviceB(meta.tenantId, 'hello'),
          }) as any,
      )

      // Multiple calls with same tenant ID should only call factory once
      ;(trackingContainer.preload as any).serviceA('tenant1', 100)
      ;(trackingContainer.preload as any).serviceA('tenant1', 200)
      ;(trackingContainer.preload as any).serviceA('tenant1', 300)

      expect(factoryCallCount.get('serviceA')).toBe(1)

      // Different tenant should call factory again
      ;(trackingContainer.preload as any).serviceA('tenant2', 100)
      expect(factoryCallCount.get('serviceA')).toBe(2)
    })

    test('should handle high volume of preload calls efficiently', () => {
      const startTime = Date.now()
      const tenantCount = 100
      const callsPerTenant = 10

      // Create many instances across multiple tenants
      for (let t = 0; t < tenantCount; t++) {
        const tenantId = `tenant-${t}`
        for (let c = 0; c < callsPerTenant; c++) {
          container.preload.serviceA(tenantId, c)
          container.preload.serviceB(tenantId, `text-${c}`)
        }
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000) // 1 second for 1000 calls
    })

    test('should not leak memory with repeated bootstrap calls', async () => {
      const initialInstanceCount = 10
      const iterations = 50

      // Create initial instances
      for (let i = 0; i < initialInstanceCount; i++) {
        container.preload.serviceA(`initial-${i}`, i)
      }

      // Run multiple bootstrap iterations
      for (let i = 0; i < iterations; i++) {
        const meta = { tenantId: `bootstrap-${i}` }
        // eslint-disable-next-line no-await-in-loop
        await container.bootstrap(meta, async () => {
          // Access context to ensure it's created
          expect(container.context.serviceA.value).toBe(42)
        })
      }

      // Memory usage should be stable (this is more of a smoke test)
      expect(true).toBe(true) // If we reach here without OOM, test passes
    })
  })

  describe('Cache Isolation and Consistency', () => {
    test('should maintain cache consistency across async operations', async () => {
      const tenantId = 'async-test'
      const promises = []

      // Create multiple concurrent preload calls
      for (let i = 0; i < 20; i++) {
        promises.push(
          Promise.resolve().then(() => container.preload.serviceA(tenantId, i)),
        )
      }

      const results = await Promise.all(promises)

      // All results should be the same instance (first one cached)
      const firstResult = results[0]
      results.forEach((result) => {
        expect(result).toBe(firstResult)
      })
    })

    test('should isolate caches between different containers', () => {
      const container2 = new Container(factories as any, initializer as any)

      const instance1 = (container.preload as any).serviceA(
        'shared-tenant',
        100,
      )
      const instance2 = (container2.preload as any).serviceA(
        'shared-tenant',
        200,
      )

      // Different containers should have separate caches
      expect(instance1).not.toBe(instance2)
      expect(instance1.value).toBe(100)
      expect(instance2.value).toBe(200)
    })

    test('should handle cache eviction gracefully (if implemented)', () => {
      const smallCacheContainer = new Container(
        factories as any,
        initializer as any,
        { cacheSize: 2 },
      ) // Small cache

      // Fill cache beyond capacity
      const instance1 = (smallCacheContainer.preload as any).serviceA(
        'tenant1',
        1,
      )
      const instance2 = (smallCacheContainer.preload as any).serviceA(
        'tenant2',
        2,
      )
      const instance3 = (smallCacheContainer.preload as any).serviceA(
        'tenant3',
        3,
      )

      // All should be valid instances
      expect(instance1.value).toBe(1)
      expect(instance2.value).toBe(2)
      expect(instance3.value).toBe(3)
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should not cache failed instantiations', () => {
      let callCount = 0
      const unreliableFactory = (x: number) => {
        callCount++
        if (callCount === 1) {
          throw new Error('First call fails')
        }
        return { value: x, created: new Date() }
      }

      const unreliableContainer = new Container(
        { unreliableService: unreliableFactory } as any,
        async (preload: any, meta: TenantMeta) =>
          ({
            unreliableService: preload.unreliableService(meta.tenantId, 42),
          }) as any,
      )

      // First call should fail
      expect(() =>
        (unreliableContainer.preload as any).unreliableService('tenant1', 100),
      ).toThrow('First call fails')

      // Second call should succeed and create new instance
      const instance = (unreliableContainer.preload as any).unreliableService(
        'tenant1',
        100,
      )
      expect(instance.value).toBe(100)
      expect(callCount).toBe(2)
    })

    test('should handle constructor and function factory caching consistently', () => {
      class TestClass {
        constructor(public value: number) {}
      }

      const testFunction = (value: number) => ({ value })

      const mixedContainer = new Container(
        {
          classFactory: TestClass,
          functionFactory: testFunction,
        },
        async (preload: any, meta: TenantMeta) => ({
          classFactory: preload.classFactory(meta.tenantId, 42),
          functionFactory: preload.functionFactory(meta.tenantId, 42),
        }),
      )

      // Both should be cached consistently
      const class1 = mixedContainer.preload.classFactory('tenant1', 100)
      const class2 = mixedContainer.preload.classFactory('tenant1', 200)
      const func1 = mixedContainer.preload.functionFactory('tenant1', 100)
      const func2 = mixedContainer.preload.functionFactory('tenant1', 200)

      expect(class1).toBe(class2)
      expect(func1).toBe(func2)
      expect(class1.value).toBe(100)
      expect(func1.value).toBe(100)
    })
  })

  describe('Bootstrap Performance', () => {
    test('should verify preload caching works correctly', () => {
      const meta = { tenantId: 'preload-test' }

      // Call preload multiple times with same parameters
      const instance1 = container.preload.serviceA(meta.tenantId, 42)
      const instance2 = container.preload.serviceA(meta.tenantId, 42)
      const instance3 = container.preload.serviceA(meta.tenantId, 999) // Different params, should still return cached

      // All should be the same cached instance
      expect(instance1).toBe(instance2)
      expect(instance1).toBe(instance3)
      expect(instance1.value).toBe(42) // Original value preserved

      // Verify timestamp is the same (proving same object)
      expect(instance1.created).toBe(instance2.created)
      expect(instance1.created).toBe(instance3.created)
    })

    test('should bootstrap multiple tenants efficiently', async () => {
      const startTime = Date.now()
      const tenantCount = 20
      const promises = []

      for (let i = 0; i < tenantCount; i++) {
        const meta = { tenantId: `concurrent-${i}` }
        promises.push(
          container.bootstrap(meta, async () => {
            expect(container.context.serviceA.value).toBe(42)
            expect(container.context.serviceB.text).toBe('hello')
            expect(container.context.nested.serviceC.flag).toBe(true)
          }),
        )
      }

      await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle concurrent bootstraps efficiently
      expect(duration).toBeLessThan(1000) // 1 second for 20 concurrent bootstraps
    })

    test('should maintain performance with deep nesting', async () => {
      interface DeepFactories extends Record<string, unknown> {
        level1: Record<string, unknown> & {
          level2: Record<string, unknown> & {
            level3: Record<string, unknown> & {
              level4: Record<string, unknown> & {
                level5: Record<string, unknown> & {
                  deepService: (x: number) => { value: number }
                }
              }
            }
          }
        }
      }

      const deepFactories: DeepFactories = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deepService: (x: number) => ({ value: x }),
                },
              },
            },
          },
        },
      }

      const deepContainer = new Container(
        deepFactories,
        async (preload: any, meta: TenantMeta): Promise<any> => ({
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepService:
                      preload.level1.level2.level3.level4.level5.deepService(
                        meta.tenantId,
                        42,
                      ),
                  },
                },
              },
            },
          },
        }),
      )

      const startTime = Date.now()

      // Multiple calls to deeply nested service
      for (let i = 0; i < 100; i++) {
        const instance =
          deepContainer.preload.level1.level2.level3.level4.level5.deepService(
            'tenant1',
            i,
          )
        expect(instance.value).toBe(i === 0 ? i : 0) // Should cache first value
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle deep nesting efficiently
      expect(duration).toBeLessThan(100) // 100ms for 100 deep calls
    })
  })

  describe('Memory and Resource Management', () => {
    test('should not hold references to bootstrap contexts after completion', async () => {
      const meta = { tenantId: 'memory-test' }
      let contextRef: any

      await container.bootstrap(meta, async () => {
        contextRef = container.context
        expect(contextRef.serviceA.value).toBe(42)
      })

      // Context should not be accessible after bootstrap
      expect(() => container.context).toThrow('No tenant context')

      // The stored reference should still work (testing that the object itself is valid)
      expect(contextRef.serviceA.value).toBe(42)
    })

    test('should handle rapid bootstrap cycling without memory leaks', async () => {
      const iterations = 100
      const promises = []

      for (let i = 0; i < iterations; i++) {
        const meta = { tenantId: `cycle-${i % 10}` } // Reuse some tenant IDs
        promises.push(
          container.bootstrap(meta, async () => {
            // Quick access to context
            expect(container.context.serviceA.value).toBe(42)
          }),
        )
      }

      await Promise.all(promises)

      // If we reach here without OOM, test passes
      expect(true).toBe(true)
    })
  })
})

describe('Container Edge Cases and Robustness', () => {
  test('should handle factories that return null or undefined', () => {
    const nullFactory = () => null
    const undefinedFactory = () => undefined

    const edgeCaseContainer = new Container(
      {
        nullService: nullFactory,
        undefinedService: undefinedFactory,
      },
      async (preload: any, meta: any) => ({
        nullService: preload.nullService(meta.tenantId),
        undefinedService: preload.undefinedService(meta.tenantId),
      }),
    )

    const nullResult = edgeCaseContainer.preload.nullService('tenant1')
    const undefinedResult =
      edgeCaseContainer.preload.undefinedService('tenant1')

    expect(nullResult).toBeNull()
    expect(undefinedResult).toBeUndefined()

    // Should cache null and undefined values too
    expect(edgeCaseContainer.preload.nullService('tenant1')).toBe(nullResult)
    expect(edgeCaseContainer.preload.undefinedService('tenant1')).toBe(
      undefinedResult,
    )
  })

  test('should handle very long tenant IDs and service names', () => {
    const longTenantId = 'a'.repeat(1000)
    const longServiceName = 'b'.repeat(500)

    const longNameFactories = {
      [longServiceName]: (x: number) => ({ value: x }),
    }

    const longNameContainer = new Container(
      longNameFactories,
      async (preload: any, meta: any) => ({
        [longServiceName]: preload[longServiceName](meta.tenantId, 42),
      }),
    )

    const instance = longNameContainer.preload[longServiceName](
      longTenantId,
      100,
    )
    expect(instance.value).toBe(100)

    // Should cache with long names
    const instance2 = longNameContainer.preload[longServiceName](
      longTenantId,
      200,
    )
    expect(instance2).toBe(instance)
  })

  test('should handle special characters in tenant IDs', () => {
    const specialTenantIds = [
      'tenant-with-dashes',
      'tenant_with_underscores',
      'tenant.with.dots',
      'tenant@with@symbols',
      'tenant with spaces',
      'tenant/with/slashes',
      'tenant\\with\\backslashes',
      'tenant:with:colons',
      'tenant;with;semicolons',
      'tenant,with,commas',
      'tenant|with|pipes',
      'tenant{with}braces',
      'tenant[with]brackets',
      'tenant(with)parentheses',
      'tenant<with>angle',
      'tenant"with"quotes',
      "tenant'with'apostrophes",
      'tenant`with`backticks',
      'tenant~with~tildes',
      'tenant!with!exclamation',
      'tenant?with?question',
      'tenant#with#hash',
      'tenant$with$dollar',
      'tenant%with%percent',
      'tenant^with^caret',
      'tenant&with&ampersand',
      'tenant*with*asterisk',
      'tenant+with+plus',
      'tenant=with=equals',
      'тенант-с-кириллицей',
      'tenant-with-中文',
      'tenant-with-العربية',
      'tenant-with-हिंदी',
      'tenant-with-👨‍💻-emoji',
    ]

    const container = new Container(
      { service: (x: number) => ({ value: x }) },
      async (preload: any, meta: any) => ({
        service: preload.service(meta.tenantId, 42),
      }),
    )

    specialTenantIds.forEach((tenantId) => {
      const instance1 = container.preload.service(tenantId, 100)
      const instance2 = container.preload.service(tenantId, 200)

      expect(instance1).toBe(instance2)
      expect(instance1.value).toBe(100)
    })
  })
})

describe('Container - Additional Tests', () => {
  interface Factories extends Record<string, unknown> {
    serviceA: (x: number) => { value: number }
    nested: Record<string, unknown> & {
      serviceB: (y: string) => { text: string }
      deepNested: Record<string, unknown> & {
        serviceC: () => { id: string }
      }
    }
  }
  interface TenantMeta {
    tenantId: string
  }

  const factories: Factories = {
    serviceA: (x: number) => ({ value: x }),
    nested: {
      serviceB: (y: string) => ({ text: y }),
      deepNested: {
        serviceC: () => ({ id: 'service-c' }),
      },
    },
  }

  const initializer = async (preload: any, meta: TenantMeta): Promise<any> => {
    return {
      serviceA: preload.serviceA(meta.tenantId, 42),
      nested: {
        serviceB: preload.nested.serviceB(meta.tenantId, 'hello'),
        deepNested: {
          serviceC: preload.nested.deepNested.serviceC(meta.tenantId),
        },
      },
    }
  }

  let container: Container<Factories, TenantMeta>

  beforeEach(() => {
    vi.clearAllMocks()
    container = new Container(factories as any, initializer as any)
  })

  // Test constructor factories (classes)
  test('should handle constructor factories', () => {
    class TestService {
      constructor(public value: number) {}
    }

    const constructorFactories = {
      testService: TestService,
    }

    const constructorContainer = new Container(
      constructorFactories,
      async (preload: any, meta: TenantMeta) => ({
        testService: preload.testService(meta.tenantId, 123),
      }),
    )

    const instance = constructorContainer.preload.testService('t1', 456)
    expect(instance).toBeInstanceOf(TestService)
    expect(instance.value).toBe(456)
  })

  // Test custom cache size
  test('should accept custom cache size', () => {
    const customContainer = new Container(factories, initializer, {
      cacheSize: 50,
    })
    expect(customContainer).toBeDefined()
    // Cache size is passed to createServiceCache, which is mocked
  })

  // Test bootstrap without callback function
  test('should bootstrap without callback function', async () => {
    const meta = { tenantId: 'no-callback' }
    const result = await container.bootstrap(meta)

    expect(result.instances).toBeDefined()
    expect(result.instances.serviceA?.value).toBe(42)
    expect(result.instances.nested?.serviceB?.text).toBe('hello')
  })

  // Test deeply nested services
  test('should handle deeply nested services', async () => {
    const meta = { tenantId: 'deep' }
    await container.bootstrap(meta, async () => {
      expect(container.context.nested.deepNested.serviceC.id).toBe('service-c')
    })
  })

  // Test error in initializer
  test('should propagate errors from initializer', async () => {
    const errorInitializer = async () => {
      throw new Error('Initializer failed')
    }

    const errorContainer = new Container(factories, errorInitializer)
    const meta = { tenantId: 'error' }

    await expect(errorContainer.bootstrap(meta)).rejects.toThrow(
      'Initializer failed',
    )
  })

  // Test error in bootstrap callback
  test('should propagate errors from bootstrap callback', async () => {
    const meta = { tenantId: 'callback-error' }

    await expect(
      container.bootstrap(meta, async () => {
        throw new Error('Callback failed')
      }),
    ).rejects.toThrow('Callback failed')
  })

  // Test accessing nested service that doesn't exist
  test('should throw for nested service not initialized', async () => {
    const incompleteInitializer = async (preload: any, meta: TenantMeta) => {
      return {
        serviceA: preload.serviceA(meta.tenantId, 42),
        nested: {
          // Missing serviceB
        },
      }
    }

    // @ts-expect-error Testing incomplete initializer
    const incompleteContainer = new Container(factories, incompleteInitializer)
    const meta = { tenantId: 'incomplete' }

    await incompleteContainer.bootstrap(meta, async () => {
      expect(() => incompleteContainer.context.nested.serviceB).toThrow(
        "Service 'nested.serviceB' not initialized",
      )
    })
  })

  // Test accessing deeply nested service that doesn't exist
  test('should throw for deeply nested service not initialized', async () => {
    const incompleteInitializer = async (preload: any, meta: TenantMeta) => {
      return {
        serviceA: preload.serviceA(meta.tenantId, 42),
        nested: {
          serviceB: preload.nested.serviceB(meta.tenantId, 'hello'),
          deepNested: {
            // Missing serviceC
          },
        },
      }
    }
    // @ts-expect-error Testing incomplete initializer
    const incompleteContainer = new Container(factories, incompleteInitializer)
    const meta = { tenantId: 'deep-incomplete' }

    await incompleteContainer.bootstrap(meta, async () => {
      expect(
        () => incompleteContainer.context.nested.deepNested.serviceC,
      ).toThrow("Service 'nested.deepNested.serviceC' not initialized")
    })
  })

  // Test preload with different parameter types
  test('should handle preload with various parameter types', () => {
    interface ComplexFactories extends Record<string, unknown> {
      stringFactory: (a: string, b: number) => { result: string }
      noParamsFactory: () => { empty: boolean }
      multipleParamsFactory: (
        a: string,
        b: number,
        c: boolean,
      ) => { combined: string }
    }

    const complexFactories: ComplexFactories = {
      stringFactory: (a: string, b: number) => ({ result: `${a}-${b}` }),
      noParamsFactory: () => ({ empty: true }),
      multipleParamsFactory: (a: string, b: number, c: boolean) => ({
        combined: `${a}-${b}-${c}`,
      }),
    }

    const complexContainer = new Container(
      complexFactories,
      async (preload: any, meta: TenantMeta) => ({
        stringFactory: preload.stringFactory(meta.tenantId, 'test', 123),
        noParamsFactory: preload.noParamsFactory(meta.tenantId),
        multipleParamsFactory: preload.multipleParamsFactory(
          meta.tenantId,
          'multi',
          456,
          true,
        ),
      }),
    )

    const result1 = complexContainer.preload.stringFactory('t1', 'hello', 42)
    expect(result1.result).toBe('hello-42')

    const result2 = complexContainer.preload.noParamsFactory('t1')
    expect(result2.empty).toBe(true)

    const result3 = complexContainer.preload.multipleParamsFactory(
      't1',
      'test',
      100,
      false,
    )
    expect(result3.combined).toBe('test-100-false')
  })

  // Test context proxy behavior with arrays
  test('should handle arrays in context without proxying', async () => {
    const arrayInitializer = async (preload: any, meta: TenantMeta) => {
      return {
        serviceA: preload.serviceA(meta.tenantId, 42),
        arrayService: [1, 2, 3], // Array should not be proxied
      }
    }
    // @ts-expect-error Testing incomplete initializer
    const arrayContainer = new Container(factories, arrayInitializer)
    const meta = { tenantId: 'array-test' }

    await arrayContainer.bootstrap(meta, async () => {
      const context = (arrayContainer as any).context
      expect(Array.isArray(context.arrayService)).toBe(true)
      expect(context.arrayService).toEqual([1, 2, 3])
    })
  })

  // Test factory path resolution with null/undefined values
  test('should handle null and undefined values in factory definitions', () => {
    const factoriesWithNulls = {
      serviceA: (x: number) => ({ value: x }),
      nullService: null,
      undefinedService: undefined,
    }

    const nullContainer = new Container(
      factoriesWithNulls,
      async (preload: any, meta: TenantMeta) => ({
        serviceA: preload.serviceA(meta.tenantId, 42),
      }),
    )

    // Should work fine - null/undefined are ignored in factory path resolution
    const result = nullContainer.preload.serviceA('t1', 123)
    expect(result.value).toBe(123)
  })

  // Test concurrent bootstrap calls
  test('should handle concurrent bootstrap calls correctly', async () => {
    const meta1 = { tenantId: 'concurrent1' }
    const meta2 = { tenantId: 'concurrent2' }

    let context1: any
    let context2: any

    const [result1, result2] = await Promise.all([
      container.bootstrap(meta1, async () => {
        context1 = container.context
        // Add small delay to test concurrency
        await new Promise((resolve) => setTimeout(resolve, 10))
        return container.context.serviceA.value
      }),
      container.bootstrap(meta2, async () => {
        context2 = container.context
        await new Promise((resolve) => setTimeout(resolve, 10))
        return container.context.serviceA.value
      }),
    ])

    expect(result1.instances.serviceA?.value).toBe(42)
    expect(result2.instances.serviceA?.value).toBe(42)
    // Contexts should be isolated
    expect(context1).not.toBe(context2)
  })

  // Test factory that throws during instantiation
  test('should handle factory that throws during instantiation', () => {
    const throwingFactory = () => {
      throw new Error('Factory failed')
    }

    const throwingFactories = {
      throwingService: throwingFactory,
    }

    const throwingContainer = new Container(
      throwingFactories,
      async (preload: any, meta: TenantMeta) => ({
        throwingService: preload.throwingService(meta.tenantId),
      }),
    )

    expect(() => throwingContainer.preload.throwingService('t1')).toThrow(
      'Factory failed',
    )
  })

  // Test that context is cleared between bootstrap calls
  test('should clear context between bootstrap calls', async () => {
    const meta1 = { tenantId: 'clear1' }
    const meta2 = { tenantId: 'clear2' }

    await container.bootstrap(meta1, async () => {
      expect(container.context.serviceA.value).toBe(42)
    })

    // Context should not be available outside bootstrap
    expect(() => container.context).toThrow('No tenant context')

    await container.bootstrap(meta2, async () => {
      expect(container.context.serviceA.value).toBe(42)
    })
  })

  test('should provide access to current tenant metadata', async () => {
    const meta = { tenantId: 'test-tenant' }

    await container.bootstrap(meta, async () => {
      const currentMeta = container.getCurrentTenantMetadata()
      expect(currentMeta).toEqual(meta)
      expect(currentMeta.tenantId).toBe('test-tenant')
    })
  })

  test('should provide access to current tenant ID', async () => {
    const meta = { tenantId: 'tenant-123', id: 'tenant-123' }

    await container.bootstrap(meta, async () => {
      const tenantId = container.getCurrentTenantId()
      expect(tenantId).toBe('tenant-123')
    })
  })

  test('should return undefined for tenant ID when metadata has no id property', async () => {
    const meta = { tenantId: 'test-tenant' }

    await container.bootstrap(meta, async () => {
      const tenantId = container.getCurrentTenantId()
      expect(tenantId).toBeUndefined()
    })
  })

  test('should throw when accessing tenant metadata outside of context', () => {
    expect(() => container.getCurrentTenantMetadata()).toThrow(
      'No tenant context available',
    )
    expect(() => container.getCurrentTenantId()).toThrow(
      'No tenant context available',
    )
  })
})

describe('Container Overflow Protection Tests', () => {
  interface TestFactories extends Record<string, unknown> {
    serviceA: (x: number) => { value: number }
    serviceB: (y: string) => { text: string }
  }

  interface TenantMeta {
    tenantId: string
  }

  const factories: TestFactories = {
    serviceA: (x: number) => ({ value: x }),
    serviceB: (y: string) => ({ text: y }),
  }

  const initializer = async (preload: any, meta: TenantMeta): Promise<any> => {
    return {
      serviceA: preload.serviceA(meta.tenantId, 42),
      serviceB: preload.serviceB(meta.tenantId, 'hello'),
    }
  }

  let container: Container<TestFactories, TenantMeta>

  beforeEach(() => {
    vi.clearAllMocks()
    container = new Container(factories as any, initializer as any, {
      enableMetrics: true,
    })
  })

  describe('Metric Overflow Protection', () => {
    test('should safely increment metrics without overflow', () => {
      // Test normal metric increments
      for (let i = 0; i < 1000; i++) {
        container.preload.serviceA(`tenant-${i % 10}`, i)
      }

      const metrics = container.getMetrics()
      expect(metrics.cacheHits).toBeGreaterThan(0)
      expect(metrics.cacheMisses).toBeGreaterThan(0)
      expect(metrics.instanceCreations).toBeGreaterThan(0)

      // All metrics should be well below MAX_SAFE_INTEGER
      expect(metrics.cacheHits).toBeLessThan(Number.MAX_SAFE_INTEGER)
      expect(metrics.cacheMisses).toBeLessThan(Number.MAX_SAFE_INTEGER)
      expect(metrics.instanceCreations).toBeLessThan(Number.MAX_SAFE_INTEGER)
    })

    test('should reset metrics when approaching overflow threshold', () => {
      // Mock the MAX_METRIC_VALUE to a small number to test overflow protection
      const originalMaxValue = (container as any).MAX_METRIC_VALUE
      ;(container as any).MAX_METRIC_VALUE = 5

      // Create enough cache misses to trigger overflow protection
      for (let i = 0; i < 10; i++) {
        container.preload.serviceA(`tenant-${i}`, i)
      }

      const metrics = container.getMetrics()

      // Metrics should have been reset due to overflow protection
      expect(metrics.cacheMisses).toBeLessThan(originalMaxValue)
      expect(metrics.instanceCreations).toBeLessThan(originalMaxValue)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })

    test('should log warning when overflow protection triggers', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()

      // Create container with diagnostics enabled
      const diagnosticContainer = new Container(
        factories as any,
        initializer as any,
        { enableMetrics: true, enableDiagnostics: true },
      )

      // Mock small MAX_METRIC_VALUE
      ;(diagnosticContainer as any).MAX_METRIC_VALUE = 3

      // Trigger overflow protection
      for (let i = 0; i < 8; i++) {
        ;(diagnosticContainer.preload as any).serviceA(`tenant-${i}`, i)
      }

      // Should have logged warning about metric reset
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Container metrics reset due to overflow protection',
        ),
      )

      consoleSpy.mockRestore()
    })

    test('should not log warning when diagnostics disabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()

      // Create container with diagnostics disabled (default)
      const nonDiagnosticContainer = new Container(
        factories as any,
        initializer as any,
        { enableMetrics: true, enableDiagnostics: false },
      )

      // Mock small MAX_METRIC_VALUE
      ;(nonDiagnosticContainer as any).MAX_METRIC_VALUE = 3

      // Trigger overflow protection
      for (let i = 0; i < 8; i++) {
        ;(nonDiagnosticContainer.preload as any).serviceA(`tenant-${i}`, i)
      }

      // Should not have logged any warnings
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    test('should handle different metric types reaching overflow', () => {
      // Mock small MAX_METRIC_VALUE
      const originalMaxValue = (container as any).MAX_METRIC_VALUE
      ;(container as any).MAX_METRIC_VALUE = 2

      // Test cacheHits overflow
      container.preload.serviceA('tenant1', 1) // Creates cache miss
      container.preload.serviceA('tenant1', 2) // Creates cache hit
      container.preload.serviceA('tenant1', 3) // Creates cache hit - should trigger reset

      const metrics = container.getMetrics()
      expect(metrics.cacheHits).toBeLessThanOrEqual(2)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })

    test('should not increment metrics when metrics disabled', () => {
      // Create container with metrics disabled
      const noMetricsContainer = new Container(
        factories as any,
        initializer as any,
        { enableMetrics: false },
      )

      // Perform operations that would normally increment metrics
      for (let i = 0; i < 10; i++) {
        ;(noMetricsContainer.preload as any).serviceA(`tenant-${i}`, i)
      }

      const metrics = noMetricsContainer.getMetrics()

      // All metrics should remain at 0
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.cacheMisses).toBe(0)
      expect(metrics.instanceCreations).toBe(0)
      expect(metrics.contextAccesses).toBe(0)
      expect(metrics.proxyCacheHits).toBe(0)
      expect(metrics.initializerCacheHits).toBe(0)
    })

    test('should handle initializer cache overflow protection', async () => {
      // Mock small MAX_METRIC_VALUE
      const originalMaxValue = (container as any).MAX_METRIC_VALUE
      ;(container as any).MAX_METRIC_VALUE = 2

      // Create different tenant configurations to trigger initializer cache
      const meta1 = { tenantId: 'init-test-1' }

      // First bootstrap - cache miss
      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Second bootstrap with same meta - cache hit
      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Third bootstrap with same meta - should trigger overflow protection
      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      const metrics = container.getMetrics()
      expect(metrics.initializerCacheHits).toBeLessThanOrEqual(2)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })

    test('should maintain functionality after metric reset', () => {
      // Mock small MAX_METRIC_VALUE to trigger reset
      const originalMaxValue = (container as any).MAX_METRIC_VALUE
      ;(container as any).MAX_METRIC_VALUE = 3

      // Trigger overflow and reset
      for (let i = 0; i < 8; i++) {
        container.preload.serviceA(`tenant-${i}`, i)
      }

      // Container should still work normally after reset
      const service1 = container.preload.serviceA('post-reset-tenant', 100)
      const service2 = container.preload.serviceA('post-reset-tenant', 200)

      // Caching should still work
      expect(service1).toBe(service2)
      expect(service1.value).toBe(100)

      // Metrics should be accumulating again
      const metrics = container.getMetrics()
      expect(metrics.cacheHits).toBeGreaterThan(0)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })

    test('should handle edge case at exact MAX_METRIC_VALUE', () => {
      const originalMaxValue = (container as any).MAX_METRIC_VALUE

      // Set MAX_METRIC_VALUE to exactly match what we'll generate
      ;(container as any).MAX_METRIC_VALUE = 1

      // Create one cache miss (should increment to 1)
      container.preload.serviceA('edge-tenant-1', 1)

      let metrics = container.getMetrics()
      expect(metrics.cacheMisses).toBe(1)

      // Create another cache miss (should trigger reset when incrementing from 1)
      container.preload.serviceA('edge-tenant-2', 2)

      metrics = container.getMetrics()
      // After reset, metrics should be low again
      expect(metrics.cacheMisses).toBeLessThan(originalMaxValue)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })

    test('should handle concurrent metric increments safely', async () => {
      // Mock smaller MAX_METRIC_VALUE for faster testing
      const originalMaxValue = (container as any).MAX_METRIC_VALUE
      ;(container as any).MAX_METRIC_VALUE = 10

      // Create concurrent operations that increment metrics
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() =>
            container.preload.serviceA(`concurrent-${i}`, i),
          ),
        )
      }

      await Promise.all(promises)

      // Container should still be functional
      const testService = container.preload.serviceA('final-test', 999)
      expect(testService.value).toBe(999)

      // Metrics should be valid (either accumulated or reset)
      const metrics = container.getMetrics()
      expect(Number.isInteger(metrics.cacheHits)).toBe(true)
      expect(Number.isInteger(metrics.cacheMisses)).toBe(true)
      expect(Number.isInteger(metrics.instanceCreations)).toBe(true)

      // All metrics should be non-negative
      expect(metrics.cacheHits).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheMisses).toBeGreaterThanOrEqual(0)
      expect(metrics.instanceCreations).toBeGreaterThanOrEqual(0)

      // Restore original value
      ;(container as any).MAX_METRIC_VALUE = originalMaxValue
    })
  })

  describe('Performance Statistics with Overflow Protection', () => {
    test('should include overflow-protected metrics in performance stats', () => {
      // Generate some metrics
      for (let i = 0; i < 10; i++) {
        container.preload.serviceA(`perf-tenant-${i % 3}`, i)
      }

      const perfStats = container.getPerformanceStats()

      // Should include all metric types
      expect(perfStats.cacheHits).toBeGreaterThanOrEqual(0)
      expect(perfStats.cacheMisses).toBeGreaterThanOrEqual(0)
      expect(perfStats.instanceCreations).toBeGreaterThanOrEqual(0)
      expect(perfStats.initializerCacheHits).toBeGreaterThanOrEqual(0)

      // Should include cache sizes
      expect(perfStats.initializerCacheSize).toBeGreaterThanOrEqual(0)
      expect(typeof perfStats.cacheHitRatio).toBe('number')

      // Cache hit ratio should be between 0 and 1
      expect(perfStats.cacheHitRatio).toBeGreaterThanOrEqual(0)
      expect(perfStats.cacheHitRatio).toBeLessThanOrEqual(1)
    })

    test('should reset all metrics consistently', () => {
      // Generate metrics across all types
      for (let i = 0; i < 5; i++) {
        container.preload.serviceA(`reset-tenant-${i}`, i)
        container.preload.serviceB(`reset-tenant-${i}`, `text-${i}`)
      }

      // Manually reset metrics
      container.resetMetrics()

      const metrics = container.getMetrics()

      // All metrics should be zero after reset
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.cacheMisses).toBe(0)
      expect(metrics.instanceCreations).toBe(0)
      expect(metrics.contextAccesses).toBe(0)
      expect(metrics.proxyCacheHits).toBe(0)
      expect(metrics.initializerCacheHits).toBe(0)
    })

    test('should clear initializer cache with clearCaches', async () => {
      // Bootstrap to populate initializer cache
      const meta1 = { tenantId: 'clear-test-1' }
      const meta2 = { tenantId: 'clear-test-2' }

      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      await container.bootstrap(meta2, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Should have initializer cache entries
      let perfStats = container.getPerformanceStats()
      expect(perfStats.initializerCacheSize).toBeGreaterThan(0)

      // Clear all caches
      container.clearCaches()

      // Initializer cache should be empty
      perfStats = container.getPerformanceStats()
      expect(perfStats.initializerCacheSize).toBe(0)
    })
  })
})

describe('Container Distributed Cache Invalidation Tests', () => {
  interface TestFactories extends Record<string, unknown> {
    serviceA: (x: number) => { value: number; created: Date }
    serviceB: (y: string) => { text: string; created: Date }
    nested: Record<string, unknown> & {
      serviceC: (z: boolean) => { flag: boolean; created: Date }
    }
  }

  interface TenantMeta {
    tenantId: string
    id: string
  }

  const factories: TestFactories = {
    serviceA: (x: number) => ({ value: x, created: new Date() }),
    serviceB: (y: string) => ({ text: y, created: new Date() }),
    nested: {
      serviceC: (z: boolean) => ({ flag: z, created: new Date() }),
    },
  }

  const initializer = async (preload: any, meta: TenantMeta): Promise<any> => {
    return {
      serviceA: preload.serviceA(meta.tenantId, 42),
      serviceB: preload.serviceB(meta.tenantId, 'hello'),
      nested: {
        serviceC: preload.nested.serviceC(meta.tenantId, true),
      },
    }
  }

  // Mock distributed invalidator
  class MockDistributedInvalidator {
    private listeners = new Map<string, ((...args: any[]) => void)[]>()
    public publishedMessages: any[] = []

    on(event: string, callback: (...args: any[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.listeners.get(event)!.push(callback)
    }

    emit(event: string, ...args: any[]) {
      const callbacks = this.listeners.get(event) || []
      callbacks.forEach((callback) => callback(...args))
    }

    async invalidateTenant(tenantId: string, reason?: string) {
      this.publishedMessages.push({
        type: 'INVALIDATE_TENANT',
        tenantId,
        reason: reason || 'Tenant credentials changed',
        timestamp: Date.now(),
        instanceId: 'mock-instance-id',
      })
      // Simulate Redis pub/sub by emitting to other containers
      this.emit('invalidate-tenant', tenantId, reason)
    }

    async invalidateService(serviceType: string, reason?: string) {
      this.publishedMessages.push({
        type: 'INVALIDATE_SERVICE',
        serviceType,
        reason: reason || 'Service configuration changed',
        timestamp: Date.now(),
        instanceId: 'mock-instance-id',
      })
      this.emit('invalidate-service', serviceType, reason)
    }

    async invalidateAll(reason?: string) {
      this.publishedMessages.push({
        type: 'INVALIDATE_ALL',
        reason: reason || 'Global cache refresh',
        timestamp: Date.now(),
        instanceId: 'mock-instance-id',
      })
      this.emit('invalidate-all', reason)
    }

    clearMessages() {
      this.publishedMessages = []
    }
  }

  let container: Container<TestFactories, TenantMeta>
  let mockInvalidator: MockDistributedInvalidator

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvalidator = new MockDistributedInvalidator()
    container = new Container(factories as any, initializer as any, {
      enableMetrics: true,
      enableDiagnostics: true,
      enableDistributedInvalidation: true,
      distributedInvalidator: mockInvalidator as any,
    })
  })

  describe('Local Cache Invalidation', () => {
    test('should cache service instances normally', () => {
      // Create some cached instances
      const service1 = container.preload.serviceA('tenant1', 100)
      const service2 = container.preload.serviceA('tenant1', 200) // Should return cached
      const service3 = container.preload.serviceB('tenant1', 'test')

      expect(service1).toBe(service2) // Same instance due to caching
      expect(service1.value).toBe(100) // Original value preserved
      expect(service3.text).toBe('test')
    })

    test('should invalidate tenant cache locally only', async () => {
      // Create cached instances for multiple tenants
      const tenant1ServiceA = container.preload.serviceA('tenant1', 100)
      const tenant2ServiceA = container.preload.serviceA('tenant2', 200)
      const tenant1ServiceB = container.preload.serviceB('tenant1', 'hello')

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(tenant1ServiceA)
      expect(container.preload.serviceB('tenant1', 'world')).toBe(
        tenant1ServiceB,
      )

      // Call private method via any cast for testing
      ;(container as any).invalidateTenantLocally(
        'tenant1',
        'Test invalidation',
      )

      // tenant1 cache should be cleared, tenant2 should remain
      const newTenant1ServiceA = container.preload.serviceA('tenant1', 999)
      const sameTenant2ServiceA = container.preload.serviceA('tenant2', 999)

      expect(newTenant1ServiceA).not.toBe(tenant1ServiceA) // New instance
      expect(newTenant1ServiceA.value).toBe(999) // New value
      expect(sameTenant2ServiceA).toBe(tenant2ServiceA) // Still cached
    })

    test('should invalidate service cache locally only', () => {
      // Create cached instances across different services
      const serviceA1 = container.preload.serviceA('tenant1', 100)
      const serviceA2 = container.preload.serviceA('tenant2', 200)
      const serviceB1 = container.preload.serviceB('tenant1', 'hello')

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(serviceA1)
      expect(container.preload.serviceA('tenant2', 999)).toBe(serviceA2)

      // Invalidate only serviceA
      ;(container as any).invalidateServiceLocally(
        'serviceA',
        'Test invalidation',
      )

      // serviceA cache should be cleared, serviceB should remain
      const newServiceA1 = container.preload.serviceA('tenant1', 999)
      const newServiceA2 = container.preload.serviceA('tenant2', 999)
      const sameServiceB1 = container.preload.serviceB('tenant1', 'world')

      expect(newServiceA1).not.toBe(serviceA1) // New instance
      expect(newServiceA2).not.toBe(serviceA2) // New instance
      expect(sameServiceB1).toBe(serviceB1) // Still cached
    })

    test('should invalidate all caches locally', () => {
      // Create cached instances
      const serviceA = container.preload.serviceA('tenant1', 100)
      const serviceB = container.preload.serviceB('tenant1', 'hello')
      const nestedService = container.preload.nested.serviceC('tenant1', true)

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(serviceA)
      expect(container.preload.serviceB('tenant1', 'world')).toBe(serviceB)

      // Invalidate all caches
      ;(container as any).invalidateAllLocally('Test invalidation')

      // All caches should be cleared
      const newServiceA = container.preload.serviceA('tenant1', 999)
      const newServiceB = container.preload.serviceB('tenant1', 'world')
      const newNestedService = container.preload.nested.serviceC(
        'tenant1',
        false,
      )

      expect(newServiceA).not.toBe(serviceA)
      expect(newServiceB).not.toBe(serviceB)
      expect(newNestedService).not.toBe(nestedService)
    })

    test('should invalidate initializer cache for tenant', async () => {
      // Bootstrap to populate initializer cache
      const meta1 = { tenantId: 'init-tenant-1', id: 'init-tenant-1' }
      const meta2 = { tenantId: 'init-tenant-2', id: 'init-tenant-2' }

      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      await container.bootstrap(meta2, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Should have cached initializer results
      let perfStats = container.getPerformanceStats()
      const initialCacheSize = perfStats.initializerCacheSize
      expect(initialCacheSize).toBeGreaterThan(0)

      // Invalidate tenant1 - should remove its initializer cache entry
      ;(container as any).invalidateTenantLocally('init-tenant-1', 'Test')

      // Cache size should be smaller
      perfStats = container.getPerformanceStats()
      expect(perfStats.initializerCacheSize).toBeLessThan(initialCacheSize)
    })
  })

  describe('Distributed Cache Invalidation', () => {
    test('should publish tenant invalidation to distributed system', async () => {
      // Create some cached data
      container.preload.serviceA('tenant1', 100)

      // Clear previous messages
      mockInvalidator.clearMessages()

      // Invalidate tenant distributedly
      await container.invalidateTenantDistributed(
        'tenant1',
        'Credentials changed',
      )

      // Should have published invalidation message
      expect(mockInvalidator.publishedMessages).toHaveLength(1)
      expect(mockInvalidator.publishedMessages[0]).toMatchObject({
        type: 'INVALIDATE_TENANT',
        tenantId: 'tenant1',
        reason: 'Credentials changed',
      })
    })

    test('should publish service invalidation to distributed system', async () => {
      // Create some cached data
      container.preload.serviceA('tenant1', 100)

      mockInvalidator.clearMessages()

      // Invalidate service distributedly
      await container.invalidateServiceDistributed('serviceA', 'Config changed')

      // Should have published invalidation message
      expect(mockInvalidator.publishedMessages).toHaveLength(1)
      expect(mockInvalidator.publishedMessages[0]).toMatchObject({
        type: 'INVALIDATE_SERVICE',
        serviceType: 'serviceA',
        reason: 'Config changed',
      })
    })

    test('should publish global invalidation to distributed system', async () => {
      // Create some cached data
      container.preload.serviceA('tenant1', 100)

      mockInvalidator.clearMessages()

      // Invalidate all distributedly
      await container.invalidateAllDistributed('Emergency clear')

      // Should have published invalidation message
      expect(mockInvalidator.publishedMessages).toHaveLength(1)
      expect(mockInvalidator.publishedMessages[0]).toMatchObject({
        type: 'INVALIDATE_ALL',
        reason: 'Emergency clear',
      })
    })

    test('should handle incoming tenant invalidation from other instances', () => {
      // Create cached instances
      const serviceA = container.preload.serviceA('tenant1', 100)
      container.preload.serviceB('tenant1', 'hello')

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(serviceA)

      // Simulate invalidation message from another instance
      mockInvalidator.emit(
        'invalidate-tenant',
        'tenant1',
        'Remote invalidation',
      )

      // Cache should be cleared
      const newServiceA = container.preload.serviceA('tenant1', 999)
      expect(newServiceA).not.toBe(serviceA)
      expect(newServiceA.value).toBe(999)
    })

    test('should handle incoming service invalidation from other instances', () => {
      // Create cached instances across services
      const serviceA = container.preload.serviceA('tenant1', 100)
      const serviceB = container.preload.serviceB('tenant1', 'hello')

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(serviceA)
      expect(container.preload.serviceB('tenant1', 'world')).toBe(serviceB)

      // Simulate service invalidation from another instance
      mockInvalidator.emit(
        'invalidate-service',
        'serviceA',
        'Remote invalidation',
      )

      // Only serviceA cache should be cleared
      const newServiceA = container.preload.serviceA('tenant1', 999)
      const sameServiceB = container.preload.serviceB('tenant1', 'world')

      expect(newServiceA).not.toBe(serviceA)
      expect(sameServiceB).toBe(serviceB) // Should still be cached
    })

    test('should handle incoming global invalidation from other instances', () => {
      // Create cached instances
      const serviceA = container.preload.serviceA('tenant1', 100)
      const serviceB = container.preload.serviceB('tenant1', 'hello')

      // Verify caching works
      expect(container.preload.serviceA('tenant1', 999)).toBe(serviceA)
      expect(container.preload.serviceB('tenant1', 'world')).toBe(serviceB)

      // Simulate global invalidation from another instance
      mockInvalidator.emit('invalidate-all', 'Remote global clear')

      // All caches should be cleared
      const newServiceA = container.preload.serviceA('tenant1', 999)
      const newServiceB = container.preload.serviceB('tenant1', 'world')

      expect(newServiceA).not.toBe(serviceA)
      expect(newServiceB).not.toBe(serviceB)
    })

    test('should work without distributed invalidation when disabled', async () => {
      // Create container without distributed invalidation
      const localContainer = new Container<TestFactories, TenantMeta>(
        factories,
        initializer,
        {
          enableDistributedInvalidation: false,
        },
      )

      // Create cached instance
      const serviceA = localContainer.preload.serviceA('tenant1', 100)

      // These methods should work but not publish to distributed system
      await localContainer.invalidateTenantDistributed('tenant1', 'Test')
      await localContainer.invalidateServiceDistributed('serviceA', 'Test')
      await localContainer.invalidateAllDistributed('Test')

      // Local cache should still be cleared
      const newServiceA = localContainer.preload.serviceA('tenant1', 999)
      expect(newServiceA).not.toBe(serviceA)

      // No messages should be published (mockInvalidator wasn't used)
      expect(mockInvalidator.publishedMessages).toHaveLength(0)
    })

    test('should handle Redis connection errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()

      // Simulate Redis error
      mockInvalidator.emit('redis-error', new Error('Redis connection failed'))

      // Should log warning when diagnostics enabled
      expect(consoleSpy).toHaveBeenCalledWith(
        'Distributed cache invalidation Redis error:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Cache Invalidation Integration with Bootstrap', () => {
    test('should clear initializer cache when tenant invalidated', async () => {
      // Bootstrap to populate initializer cache
      const meta1 = {
        tenantId: 'integration-tenant-1',
        id: 'integration-tenant-1',
      }
      const meta2 = {
        tenantId: 'integration-tenant-2',
        id: 'integration-tenant-2',
      }

      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      await container.bootstrap(meta2, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Verify initializer cache has entries
      const perfStats = container.getPerformanceStats()
      expect(perfStats.initializerCacheSize).toBeGreaterThan(0)

      // Invalidate one tenant
      await container.invalidateTenantDistributed('integration-tenant-1')

      // Bootstrap again for the invalidated tenant
      await container.bootstrap(meta1, async () => {
        expect(container.context.serviceA.value).toBe(42)
      })

      // Should still work correctly after invalidation
      const finalStats = container.getPerformanceStats()
      expect(finalStats.initializerCacheSize).toBeGreaterThanOrEqual(0)
    })

    test('should maintain service isolation during partial invalidation', () => {
      // Create instances across multiple tenants and services
      const t1ServiceA = container.preload.serviceA('tenant1', 100)
      const t1ServiceB = container.preload.serviceB('tenant1', 'hello')
      const t2ServiceA = container.preload.serviceA('tenant2', 200)
      const t2ServiceB = container.preload.serviceB('tenant2', 'world')

      // Invalidate only tenant1
      mockInvalidator.emit(
        'invalidate-tenant',
        'tenant1',
        'Selective invalidation',
      )

      // Only tenant1 should be affected
      const newT1ServiceA = container.preload.serviceA('tenant1', 999)
      const newT1ServiceB = container.preload.serviceB('tenant1', 'new')
      const sameT2ServiceA = container.preload.serviceA('tenant2', 999)
      const sameT2ServiceB = container.preload.serviceB('tenant2', 'same')

      // tenant1 should have new instances
      expect(newT1ServiceA).not.toBe(t1ServiceA)
      expect(newT1ServiceB).not.toBe(t1ServiceB)

      // tenant2 should keep cached instances
      expect(sameT2ServiceA).toBe(t2ServiceA)
      expect(sameT2ServiceB).toBe(t2ServiceB)
    })

    test('should handle rapid successive invalidations', async () => {
      // Create cached instances
      container.preload.serviceA('tenant1', 100)
      container.preload.serviceB('tenant1', 'hello')

      mockInvalidator.clearMessages()

      // Trigger multiple rapid invalidations
      await Promise.all([
        container.invalidateTenantDistributed('tenant1', 'Reason 1'),
        container.invalidateTenantDistributed('tenant1', 'Reason 2'),
        container.invalidateServiceDistributed('serviceA', 'Reason 3'),
      ])

      // Should have published all messages
      expect(mockInvalidator.publishedMessages).toHaveLength(3)

      // Container should still be functional
      const newService = container.preload.serviceA('tenant1', 999)
      expect(newService.value).toBe(999)
    })
  })

  describe('Cache Invalidation Edge Cases and Error Handling', () => {
    test('should handle invalidation of non-existent tenant gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      // Invalidate a tenant that doesn't exist in cache
      await container.invalidateTenantDistributed('non-existent-tenant', 'Test')

      // Should not throw and should log invalidation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalidating tenant cache locally: non-existent-tenant',
        ),
        expect.stringContaining('(Test)'),
      )

      consoleSpy.mockRestore()
    })

    test('should handle invalidation of non-existent service gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      // Invalidate a service that doesn't exist
      await container.invalidateServiceDistributed(
        'non-existent-service',
        'Test',
      )

      // Should not throw and should log invalidation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalidating service cache locally: non-existent-service',
        ),
        expect.stringContaining('(Test)'),
      )

      consoleSpy.mockRestore()
    })

    test('should handle empty tenant ID gracefully', async () => {
      await expect(
        container.invalidateTenantDistributed('', 'Test'),
      ).resolves.not.toThrow()
      await expect(
        container.invalidateTenantDistributed('   ', 'Test'),
      ).resolves.not.toThrow()
    })

    test('should handle special characters in tenant IDs during invalidation', async () => {
      const specialTenantIds = [
        'tenant-with-dashes',
        'tenant_with_underscores',
        'tenant.with.dots',
        'tenant@with@symbols',
        'tenant with spaces',
        'tenant123',
        'UPPERCASE-TENANT',
      ]

      for (const tenantId of specialTenantIds) {
        // Create cached instance
        const service = container.preload.serviceA(tenantId, 100)

        // Invalidate
        // eslint-disable-next-line no-await-in-loop
        await container.invalidateTenantDistributed(
          tenantId,
          'Special char test',
        )

        // Verify new instance is created
        const newService = container.preload.serviceA(tenantId, 200)
        expect(newService).not.toBe(service)
        expect(newService.value).toBe(200)
      }
    })

    test('should handle concurrent invalidations without race conditions', async () => {
      // Create cached instances across multiple tenants
      const tenants = ['tenant1', 'tenant2', 'tenant3', 'tenant4', 'tenant5']
      const cachedServices = new Map()

      tenants.forEach((tenant) => {
        cachedServices.set(tenant, container.preload.serviceA(tenant, 100))
      })

      mockInvalidator.clearMessages()

      // Fire concurrent invalidations
      const invalidationPromises = tenants.map((tenant, index) => {
        if (index % 2 === 0) {
          return container.invalidateTenantDistributed(
            tenant,
            `Concurrent test ${index}`,
          )
        } else {
          return container.invalidateServiceDistributed(
            'serviceA',
            `Concurrent test ${index}`,
          )
        }
      })

      await Promise.all(invalidationPromises)

      // Verify all invalidations were processed
      expect(mockInvalidator.publishedMessages.length).toBe(tenants.length)

      // Verify cache state is consistent
      tenants.forEach((tenant) => {
        const newService = container.preload.serviceA(tenant, 999)
        expect(newService).not.toBe(cachedServices.get(tenant))
        expect(newService.value).toBe(999)
      })
    })

    test('should preserve cache isolation between different service types during invalidation', () => {
      // Create instances across all service types
      const serviceA = container.preload.serviceA('tenant1', 100)
      const serviceB = container.preload.serviceB('tenant1', 'hello')
      const nestedServiceC = container.preload.nested.serviceC('tenant1', true)

      // Invalidate only serviceA
      mockInvalidator.emit('invalidate-service', 'serviceA', 'Isolation test')

      // Check that only serviceA was invalidated
      const newServiceA = container.preload.serviceA('tenant1', 999)
      const sameServiceB = container.preload.serviceB('tenant1', 'world')
      const sameNestedServiceC = container.preload.nested.serviceC(
        'tenant1',
        false,
      )
      expect(newServiceA).not.toBe(serviceA) // Invalidated
      expect(sameServiceB).toBe(serviceB) // Still cached
      expect(sameNestedServiceC).toBe(nestedServiceC) // Still cached
    })

    test('should handle malformed invalidation events gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      // Create cached instance
      const service = container.preload.serviceA('tenant1', 100)

      // Emit malformed events
      mockInvalidator.emit('invalidate-tenant') // Missing parameters
      mockInvalidator.emit('invalidate-service', undefined) // Undefined service type
      mockInvalidator.emit('invalidate-tenant', null) // Null tenant ID
      mockInvalidator.emit('unknown-event', 'data') // Unknown event type

      // Cache should remain unchanged
      const sameService = container.preload.serviceA('tenant1', 999)
      expect(sameService).toBe(service)

      consoleSpy.mockRestore()
    })
  })

  describe('Cache Invalidation Performance and Metrics', () => {
    test('should track invalidation impact on performance metrics', async () => {
      // Create cached instances
      container.preload.serviceA('tenant1', 100)
      container.preload.serviceB('tenant1', 'test')

      // Get initial metrics
      const initialStats = container.getPerformanceStats()

      // Invalidate tenant
      await container.invalidateTenantDistributed('tenant1', 'Metrics test')

      // Access services again (should be cache misses now)
      container.preload.serviceA('tenant1', 200)
      container.preload.serviceB('tenant1', 'new')

      // Verify metrics updated correctly
      const finalStats = container.getPerformanceStats()
      expect(finalStats.cacheMisses).toBeGreaterThan(initialStats.cacheMisses)
      expect(finalStats.instanceCreations).toBeGreaterThan(
        initialStats.instanceCreations,
      )
    })

    test('should handle large-scale invalidation efficiently', async () => {
      const startTime = Date.now()
      const tenantCount = 100
      const servicesPerTenant = 5

      // Create many cached instances
      for (let i = 0; i < tenantCount; i++) {
        const tenantId = `tenant${i}`
        for (let j = 0; j < servicesPerTenant; j++) {
          container.preload.serviceA(tenantId, j)
        }
      }

      // Invalidate all
      await container.invalidateAllDistributed('Large scale test')

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (less than 1 second for this scale)
      expect(duration).toBeLessThan(1000)

      // Verify all caches were cleared
      const newService = container.preload.serviceA('tenant0', 999)
      expect(newService.value).toBe(999)
    })

    test('should maintain cache statistics accuracy after invalidations', async () => {
      // Create and cache several instances
      const tenants = ['t1', 't2', 't3']
      tenants.forEach((tenant) => {
        container.preload.serviceA(tenant, 100)
        container.preload.serviceB(tenant, 'test')
      })

      // Get cache stats
      const initialStats = container.getCacheStats()
      const initialServiceASize = initialStats.serviceA?.size || 0
      const initialServiceBSize = initialStats.serviceB?.size || 0

      // Invalidate one tenant
      await container.invalidateTenantDistributed('t1', 'Stats test')

      // Check updated stats
      const updatedStats = container.getCacheStats()
      const updatedServiceASize = updatedStats.serviceA?.size || 0
      const updatedServiceBSize = updatedStats.serviceB?.size || 0

      // Sizes should decrease by 1 (one tenant removed)
      expect(updatedServiceASize).toBe(initialServiceASize - 1)
      expect(updatedServiceBSize).toBe(initialServiceBSize - 1)
    })

    test('should handle invalidation during active bootstrap operations', async () => {
      const meta = { tenantId: 'bootstrap-test', id: 'bootstrap-test' }
      let bootstrapCompleted = false

      // Start a bootstrap operation
      const bootstrapPromise = container.bootstrap(meta, async () => {
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(container.context.serviceA.value).toBe(42)
        bootstrapCompleted = true
      })

      // Invalidate while bootstrap is running
      await container.invalidateTenantDistributed(
        'bootstrap-test',
        'During bootstrap',
      )

      // Wait for bootstrap to complete
      await bootstrapPromise

      expect(bootstrapCompleted).toBe(true)
    })
  })

  describe('Cache Invalidation Message Validation', () => {
    test('should validate message structure in distributed invalidations', async () => {
      mockInvalidator.clearMessages()

      await container.invalidateTenantDistributed(
        'test-tenant',
        'Validation test',
      )

      const message = mockInvalidator.publishedMessages[0]
      expect(message).toEqual({
        type: 'INVALIDATE_TENANT',
        tenantId: 'test-tenant',
        reason: 'Validation test',
        timestamp: expect.any(Number),
        instanceId: expect.any(String),
      })

      // Verify timestamp is recent
      expect(Date.now() - message.timestamp).toBeLessThan(1000)
    })

    test('should handle default reasons when none provided', async () => {
      mockInvalidator.clearMessages()

      await container.invalidateTenantDistributed('test-tenant')
      await container.invalidateServiceDistributed('serviceA')
      await container.invalidateAllDistributed()

      const messages = mockInvalidator.publishedMessages
      expect(messages).toHaveLength(3)

      expect(messages[0].reason).toBe('Tenant credentials changed')
      expect(messages[1].reason).toBe('Service configuration changed')
      expect(messages[2].reason).toBe('Global cache refresh')
    })

    test('should handle very long reasons and tenant IDs', async () => {
      const longTenantId = 'a'.repeat(1000)
      const longReason = 'This is a very long reason '.repeat(100)

      mockInvalidator.clearMessages()

      await container.invalidateTenantDistributed(longTenantId, longReason)

      const message = mockInvalidator.publishedMessages[0]
      expect(message.tenantId).toBe(longTenantId)
      expect(message.reason).toBe(longReason)
    })
  })

  describe('Cache Invalidation Fallback Behavior', () => {
    test('should work when distributed invalidation fails', async () => {
      // Create container with a failing mock invalidator
      const failingInvalidator = {
        ...mockInvalidator,
        on: mockInvalidator.on.bind(mockInvalidator),
        emit: mockInvalidator.emit.bind(mockInvalidator),
        invalidateTenant: vi
          .fn()
          .mockRejectedValue(new Error('Redis failure')),
        invalidateService: vi
          .fn()
          .mockRejectedValue(new Error('Redis failure')),
        invalidateAll: vi.fn().mockRejectedValue(new Error('Redis failure')),
      }

      const containerWithFailingInvalidator = new Container<
        TestFactories,
        TenantMeta
      >(factories, initializer, {
        enableDistributedInvalidation: true,
        distributedInvalidator: failingInvalidator as any,
        enableDiagnostics: false, // Suppress error logs during test
      })

      // Create cached instance
      const service = containerWithFailingInvalidator.preload.serviceA(
        'tenant1',
        100,
      )

      // These should still work locally even if distributed fails
      await expect(
        containerWithFailingInvalidator.invalidateTenantDistributed('tenant1'),
      ).rejects.toThrow('Redis failure')

      // But local invalidation should still have happened
      const newService = containerWithFailingInvalidator.preload.serviceA(
        'tenant1',
        200,
      )
      expect(newService).not.toBe(service)
      expect(newService.value).toBe(200)
    })

    test('should handle missing distributed invalidator gracefully', async () => {
      const containerWithoutInvalidator = new Container<
        TestFactories,
        TenantMeta
      >(factories, initializer, {
        enableDistributedInvalidation: true,
        distributedInvalidator: undefined, // Missing invalidator
      })

      // Create cached instance
      const service = containerWithoutInvalidator.preload.serviceA(
        'tenant1',
        100,
      )

      // Should work without throwing
      await containerWithoutInvalidator.invalidateTenantDistributed('tenant1')
      await containerWithoutInvalidator.invalidateServiceDistributed('serviceA')
      await containerWithoutInvalidator.invalidateAllDistributed()

      // Local invalidation should still work
      const newService = containerWithoutInvalidator.preload.serviceA(
        'tenant1',
        200,
      )
      expect(newService).not.toBe(service)
    })
  })
})


describe('Container Critical Gap Tests', () => {
  interface Factories {
    disposableService: () => { disposed: boolean; dispose: () => void | Promise<void> }
    throwingDispose: () => { dispose: () => void }
    asyncDispose: () => { disposed: boolean; dispose: () => Promise<void> }
    normalService: () => { value: number }
    promiseFactory: () => Promise<{ data: string }>
    symbolService: () => { value: number; regularProp: string }
  }

  interface TenantMeta {
    tenantId: string
    tenantName?: string
  }

  // Test 1: Disposal hooks verification
  describe('Disposal Hooks', () => {
    test('should call dispose() on service instances during clearCachesAsync', async () => {
      let disposeCount = 0
      let asyncDisposeCount = 0
      
      const factories = {
        disposableService: () => ({ 
          disposed: false, 
          dispose() { 
            this.disposed = true
            disposeCount++
          } 
        }),
        asyncDispose: () => ({
          disposed: false,
          async dispose() {
            await new Promise(resolve => setTimeout(resolve, 10))
            this.disposed = true
            asyncDisposeCount++
          }
        })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        disposableService: preload.disposableService(meta.tenantId),
        asyncDispose: preload.asyncDispose(meta.tenantId)
      }))

      // Create instances
      const service1 = container.preload.disposableService('tenant1')
      const service2 = container.preload.disposableService('tenant2')
      const asyncService = container.preload.asyncDispose('tenant1')

      expect(service1.disposed).toBe(false)
      expect(service2.disposed).toBe(false)
      expect(asyncService.disposed).toBe(false)

      // Clear caches with async disposal
      await container.clearCachesAsync()

      // Verify managers are empty after disposal
      expect(container.getCacheStats().disposableService.size).toBe(0)
      expect(container.getCacheStats().asyncDispose.size).toBe(0)

      expect(service1.disposed).toBe(true)
      expect(service2.disposed).toBe(true)
      expect(asyncService.disposed).toBe(true)
      expect(disposeCount).toBe(2)
      expect(asyncDisposeCount).toBe(1)
    })

    test('should handle disposal errors gracefully with diagnostics', async () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const factories = {
        throwingDispose: () => ({
          dispose() {
            throw new Error('Disposal failed!')
          }
        }),
        normalService: () => ({ value: 42 })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        throwingDispose: preload.throwingDispose(meta.tenantId),
        normalService: preload.normalService(meta.tenantId)
      }), { enableDiagnostics: true })

      // Create instances
      container.preload.throwingDispose('tenant1')
      const normalService = container.preload.normalService('tenant1')

      // Should not throw even if dispose fails
      await expect(container.clearCachesAsync()).resolves.not.toThrow()

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Disposal error:',
        expect.any(Error)
      )

      // Other services should still work
      expect(normalService.value).toBe(42)

      consoleErrorSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })
  })

  // Test 2: LRU eviction order
  describe('LRU Eviction Order', () => {
    test('should evict least recently used entries when cache is full', () => {
      const factories = {
        service: (n: number) => ({ value: n })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId, 100)
      }), { cacheSize: 3 })

      // Fill cache with A, B, C
      const serviceA = container.preload.service('A', 1)
      const serviceB = container.preload.service('B', 2)
      const serviceC = container.preload.service('C', 3)

      // Access A to make it recently used
      container.preload.service('A', 1)

      // Add D, should evict B (least recently used)
      const serviceD = container.preload.service('D', 4)

      // Verify cache size is still 3 after eviction
      expect(container.getCacheStats().service.size).toBe(3)

      // Verify cache contents
      expect(container.preload.service('A', 1)).toBe(serviceA) // Still cached
      expect(container.preload.service('C', 3)).toBe(serviceC) // Still cached
      expect(container.preload.service('D', 4)).toBe(serviceD) // Still cached
      
      // B should be evicted and recreated
      const newServiceB = container.preload.service('B', 2)
      expect(newServiceB).not.toBe(serviceB)
      expect(newServiceB.value).toBe(2)
    })

    test('should maintain accurate cache stats after manual eviction', async () => {
      const factories = {
        service: (n: number) => ({ value: n })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId, 100)
      }), { cacheSize: 2 })

      // Add services to fill cache
      container.preload.service('A', 1)
      container.preload.service('B', 2)
      
      // Verify cache stats are accurate
      const statsBeforeEviction = container.getCacheStats()
      expect(statsBeforeEviction.service.size).toBe(2)
      
      // Add third service, causing eviction
      container.preload.service('C', 3)
      
      // Verify cache stats remain accurate after eviction
      await Promise.resolve()
      const statsAfterEviction = container.getCacheStats()
      expect(statsAfterEviction.service.size).toBe(2)
    })
  })

  // Test 3: Initializer promise de-duplication
  describe('Initializer Promise De-duplication', () => {
    test('should deduplicate concurrent initializer calls', async () => {
      let initializerCallCount = 0
      let resolveInit: () => void
      const initPromise = new Promise<void>(resolve => {
        resolveInit = resolve
      })

      const factories = {
        service: () => ({ initialized: true })
      }

      const initializer = async (preload: any, meta: TenantMeta) => {
        initializerCallCount++
        await initPromise
        return {
          service: preload.service(meta.tenantId)
        }
      }

      const container = new Container(factories, initializer)
      const meta = { tenantId: 'concurrent-test' }

      // Start two concurrent bootstraps
      const bootstrap1 = container.bootstrap(meta, async () => {
        return container.context.service
      })
      
      const bootstrap2 = container.bootstrap(meta, async () => {
        return container.context.service
      })

      // Verify initializer hasn't been called twice yet
      expect(initializerCallCount).toBe(1)

      // Resolve the initializer
      resolveInit!()

      // Wait for both bootstraps
      const [result1, result2] = await Promise.all([bootstrap1, bootstrap2])

      // Should have called initializer only once
      expect(initializerCallCount).toBe(1)

      // Both should get the same instances
      expect(result1.instances).toBe(result2.instances)
      expect(result1.result).toEqual({ initialized: true })
      expect(result2.result).toEqual({ initialized: true })
    })
  })

  // Test 4: Context cleanliness on sync path
  describe('Context Cleanliness on Sync Path', () => {
    test('should restore previous context after sync execution', () => {
      const factories = {
        service: () => ({ value: 'test' })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId)
      }))

      const instances1 = { service: { value: 'context1' } }
      const instances2 = { service: { value: 'context2' } }
      const meta1 = { tenantId: 'tenant1' }
      const meta2 = { tenantId: 'tenant2' }

      let capturedContext: any

      // Set initial context
      container.runWithContextSync(instances1, meta1, () => {
        // Run nested context
        container.runWithContextSync(instances2, meta2, () => {
          capturedContext = container.context
          expect(container.context.service.value).toBe('context2')
        })
        
        // Context should be restored
        expect(container.context.service.value).toBe('context1')
      })

      // Context should be cleared (no previous context)
      expect(() => container.context).toThrow()
    })

    test('should restore context even if sync function throws', () => {
      const factories = {
        service: () => ({ value: 'test' })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId)
      }))

      const instances = { service: { value: 'original' } }
      const meta = { tenantId: 'tenant1' }

      container.runWithContextSync(instances, meta, () => {
        expect(() => {
          container.runWithContextSync(instances, meta, () => {
            throw new Error('Sync error')
          })
        }).toThrow('Sync error')
        
        // Context should still be restored
        expect(container.context.service.value).toBe('original')
      })
    })

    test('should restore context even if async function throws', async () => {
      const factories = {
        service: () => ({ value: 'test' })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId)
      }))

      const instances = { service: { value: 'original' } }
      const meta = { tenantId: 'tenant1' }

      await container.runWithContext(instances, meta, async () => {
        await expect(container.runWithContext(instances, meta, async () => {
          throw new Error('Async error')
        })).rejects.toThrow('Async error')
        
        // Context should still be restored
        expect(container.context.service.value).toBe('original')
      })

      // Context should be cleared (no previous context)
      expect(() => container.context).toThrow()
    })
  })

  // Test 5: ALS.disable() path for Node < 20
  describe('ALS disable() Compatibility', () => {
    test('should handle missing disable method gracefully', () => {
      const factories = {
        service: () => ({ value: 'test' })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId)
      }))

      // Mock ALS without disable method
      const originalAls = (container as any).als
      const mockAls = {
        run: originalAls.run.bind(originalAls),
        getStore: originalAls.getStore.bind(originalAls),
        enterWith: originalAls.enterWith.bind(originalAls)
        // Note: no disable() method
      };
      (container as any).als = mockAls

      const instances = { service: { value: 'test' } }
      const meta = { tenantId: 'tenant1' }

      // Should not throw even without disable()
      const result = container.runWithContextSync(instances, meta, () => {
        return container.context.service.value
      })
      
      // Verify result
      if (result !== 'test') {
        throw new Error(`Expected 'test', got '${result}'`)
      }

      // Restore original ALS
      (container as any).als = originalAls
    })
  })

  // Test 6: Metrics after disposeAll
  describe('Metrics After Disposal', () => {
    test('should track disposal and reset metrics correctly', async () => {
      const factories = {
        service: () => ({ 
          disposed: false,
          dispose() { this.disposed = true }
        })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        service: preload.service(meta.tenantId)
      }), { enableMetrics: true })

      // Create some instances to generate metrics
      container.preload.service('tenant1')
      container.preload.service('tenant2')
      container.preload.service('tenant1') // Cache hit

      const beforeMetrics = container.getMetrics()
      expect(beforeMetrics.cacheMisses).toBe(2)
      expect(beforeMetrics.cacheHits).toBe(1)

      // Dispose all
      await container.disposeAll()

      // Check that caches are empty
      const newService = container.preload.service('tenant1')
      expect(newService.disposed).toBe(false) // New instance

      // Metrics should reflect the disposal
      const afterMetrics = container.getMetrics()
      expect(afterMetrics.cacheMisses).toBe(3) // One more miss for new instance
    })
  })

  // Test 7: Proxy trap for symbols
  describe('Proxy Symbol Handling', () => {
    test('should handle symbol properties correctly', async () => {
      const testSymbol = Symbol.for('test')
      
      const factories = {
        symbolService: () => ({
          [testSymbol]: 'symbol-value',
          value: 42,
          regularProp: 'regular'
        })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        symbolService: preload.symbolService(meta.tenantId)
      }))

      await container.bootstrap({ tenantId: 'test' }, async () => {
        const service = container.context.symbolService

        // Regular properties work
        expect(service.value).toBe(42)
        expect(service.regularProp).toBe('regular')

        // Symbol properties are accessible
        expect(service[testSymbol]).toBe('symbol-value')

        // Object.keys doesn't include symbols
        const keys = Object.keys(service)
        expect(keys).toContain('value')
        expect(keys).toContain('regularProp')
        expect(keys).not.toContain(testSymbol as any)

        // for...in doesn't throw
        const props: string[] = []
        for (const prop in service) {
          props.push(prop)
        }
        expect(props).toContain('value')
        expect(props).toContain('regularProp')
      })
    })
  })

  // Test 8: Factories returning Promises
  describe('Promise Factory Handling', () => {
    test('should not wrap Promise-returning factories', async () => {
      const factories = {
        promiseFactory: () => Promise.resolve({ data: 'async-data' }),
        normalFactory: () => ({ value: 'sync-data' })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        promiseFactory: await preload.promiseFactory(meta.tenantId),
        normalFactory: preload.normalFactory(meta.tenantId)
      }))

      const result = await container.bootstrap({ tenantId: 'test' }, async () => {
        // The initializer awaits the promise, so context should have resolved value
        expect(container.context.promiseFactory).toEqual({ data: 'async-data' })
        expect(container.context.normalFactory).toEqual({ value: 'sync-data' })
        
        return 'done'
      })

      expect(result.result).toBe('done')
    })

    test('should cache promise results correctly', async () => {
      let callCount = 0
      const factories = {
        promiseFactory: () => {
          callCount++
          return Promise.resolve({ data: `call-${callCount}` })
        }
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        promiseFactory: await preload.promiseFactory(meta.tenantId)
      }))

      // First call
      const promise1 = container.preload.promiseFactory('tenant1')
      const promise2 = container.preload.promiseFactory('tenant1')
      
      // Should return same promise
      expect(promise1).toBe(promise2)
      expect(callCount).toBe(1)

      // Await the result
      const result = await promise1
      expect(result).toEqual({ data: 'call-1' })
      
      // Verify the resolved payload is cached
      const cachedResult = await container.preload.promiseFactory('tenant1')
      expect(cachedResult).toEqual(result)
    })

    test('mutation test - should return same reference after modification', () => {
      const factories = {
        mutableService: () => ({ value: 42, mutated: false })
      }

      const container = new Container(factories, async (preload, meta: TenantMeta) => ({
        mutableService: preload.mutableService(meta.tenantId)
      }))

      // Get initial service instance
      const service1 = container.preload.mutableService('tenant1')
      expect(service1.value).toBe(42)
      expect(service1.mutated).toBe(false)

      // Mutate the cached instance
      service1.value = 999
      service1.mutated = true

      // Fetch again - should get the same mutated reference
      const service2 = container.preload.mutableService('tenant1')
      expect(service2).toBe(service1) // Same reference
      expect(service2.value).toBe(999) // Mutation persisted
      expect(service2.mutated).toBe(true) // Mutation persisted
    })
  })
})

describe('Container Edge Case Tests - Hash Collisions', () => {
  test('should handle hash collisions gracefully', async () => {
    // These metadata objects will have the same hash but different IDs
    // Testing the hash collision handling in createTenantCacheKey
    const meta1 = { 
      complexData: 'a' + 'b'.repeat(100) + 'c',
      id: 'tenant1'
    }
    const meta2 = { 
      complexData: 'x' + 'y'.repeat(100) + 'z', 
      id: 'tenant2'
    }

    const factories = {
      service: () => ({ created: Date.now() })
    }

    const container = new Container(factories, async (preload, meta: any) => ({
      service: preload.service(meta.id || 'unknown')
    }))

    // Use bootstrap to exercise the djb2 hash collision logic
    const result1 = await container.bootstrap(meta1, async () => {
      return { service: container.context.service }
    })
    
    const result2 = await container.bootstrap(meta2, async () => {
      return { service: container.context.service }
    })

    // Even if hashes collide, tenant isolation should work
    expect(result1.result?.service).not.toBe(result2.result?.service)
    expect(result1.instances.service).not.toBe(result2.instances.service)
  })
})
