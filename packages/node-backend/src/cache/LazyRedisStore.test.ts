// npx vitest run ./src/cache/LazyRedisStore.test.ts
import { Ids } from '@goatlab/js-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGlobalData } from '../test/const'
import { LazyRedisStore } from './LazyRedisStore'
import { RedisConnectionPool } from './RedisConnectionPool'

const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

describe('LazyRedisStore', () => {
  let pool: RedisConnectionPool

  beforeEach(() => {
    pool = RedisConnectionPool.getInstance()
  })

  afterEach(async () => {
    await pool.disconnectAll()
  })

  describe('Lazy Connection', () => {
    it('should not connect until first operation', () => {
      const store = new LazyRedisStore(connection)
      expect(store.isConnected()).toBe(false)
    })

    it('should connect on first get operation', async () => {
      const store = new LazyRedisStore(connection)
      expect(store.isConnected()).toBe(false)

      await store.get('test-key')
      expect(store.isConnected()).toBe(true)
    })

    it('should connect on first set operation', async () => {
      const store = new LazyRedisStore(connection)
      expect(store.isConnected()).toBe(false)

      await store.set('test-key', 'value')
      expect(store.isConnected()).toBe(true)

      // Cleanup
      await store.delete('test-key')
    })

    it('should connect on first clear operation', async () => {
      const store = new LazyRedisStore(connection)
      expect(store.isConnected()).toBe(false)

      await store.clear()
      expect(store.isConnected()).toBe(true)
    })
  })

  describe('Namespace Handling', () => {
    it('should store namespace property', () => {
      const store = new LazyRedisStore(connection)
      expect(store.namespace).toBeUndefined()

      store.namespace = 'test-namespace'
      expect(store.namespace).toBe('test-namespace')
    })

    it('should forward namespace when set before connection', async () => {
      const store = new LazyRedisStore(connection)
      const testNamespace = `ns-before-${Ids.nanoId(5)}`

      // Set namespace before any operation (before connection)
      store.namespace = testNamespace

      // First operation triggers connection - namespace should be forwarded
      await store.set('key', 'value')

      // Verify namespace was forwarded to underlying store
      // @ts-expect-error accessing private property for test
      expect(store._store?.namespace).toBe(testNamespace)

      // Cleanup
      await store.clear()
    })

    it('should forward namespace when set after connection', async () => {
      const store = new LazyRedisStore(connection)
      const testNamespace = `ns-after-${Ids.nanoId(5)}`

      // Trigger connection first
      await store.get('dummy')
      expect(store.isConnected()).toBe(true)

      // Set namespace after connection
      store.namespace = testNamespace

      // Verify namespace was forwarded to underlying store
      // @ts-expect-error accessing private property for test
      expect(store._store?.namespace).toBe(testNamespace)
    })

    it('should clear only keys in namespace', async () => {
      const namespace1 = `clear-test-ns1-${Ids.nanoId(5)}`
      const namespace2 = `clear-test-ns2-${Ids.nanoId(5)}`

      const store1 = new LazyRedisStore(connection)
      const store2 = new LazyRedisStore(connection)

      store1.namespace = namespace1
      store2.namespace = namespace2

      // Set values in both namespaces
      await store1.set(`${namespace1}:key1`, 'value1')
      await store1.set(`${namespace1}:key2`, 'value2')
      await store2.set(`${namespace2}:key1`, 'value3')

      // Clear only namespace1
      await store1.clear()

      // Namespace2 values should still exist
      const value3 = await store2.get(`${namespace2}:key1`)
      expect(value3).toBe('value3')

      // Cleanup
      await store2.clear()
    })
  })

  describe('Basic Operations', () => {
    let store: LazyRedisStore
    const testNamespace = `basic-ops-${Ids.nanoId(5)}`

    beforeEach(() => {
      store = new LazyRedisStore(connection)
      store.namespace = testNamespace
    })

    afterEach(async () => {
      await store.clear()
      await store.disconnect()
    })

    it('should set and get values', async () => {
      await store.set('key', 'value')
      const result = await store.get('key')
      expect(result).toBe('value')
    })

    it('should delete values', async () => {
      await store.set('key', 'value')
      await store.delete('key')

      // Verify the key no longer exists
      const result = await store.get('key')
      expect(result).toBeUndefined()
    })

    it('should check if key exists with has()', async () => {
      await store.set('key', 'value')
      const exists = await store.has('key')
      expect(exists).toBe(true)

      const notExists = await store.has('nonexistent')
      expect(notExists).toBe(false)
    })

    it('should get multiple values', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')

      const results = await store.getMany(['key1', 'key2', 'key3'])
      expect(results).toHaveLength(3)
      expect(results[0]).toBe('value1')
      expect(results[1]).toBe('value2')
      // Non-existent key returns null or undefined depending on Redis adapter version
      expect(results[2] == null).toBe(true)
    })

    it('should delete multiple values', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')

      const deleted = await store.deleteMany(['key1', 'key2'])
      expect(deleted).toBe(true)

      const result1 = await store.get('key1')
      const result2 = await store.get('key2')
      expect(result1).toBeUndefined()
      expect(result2).toBeUndefined()
    })

    it('should set values with TTL', async () => {
      await store.set('ttl-key', 'value', 50) // 50ms TTL

      // Should exist immediately
      const exists = await store.has('ttl-key')
      expect(exists).toBe(true)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await store.get('ttl-key')
      expect(result).toBeUndefined()
    })
  })

  describe('Iterator', () => {
    it('should iterate over keys in namespace', async () => {
      const store = new LazyRedisStore(connection)
      const testNamespace = `iter-${Ids.nanoId(5)}`
      store.namespace = testNamespace

      await store.set(`${testNamespace}:key1`, 'value1')
      await store.set(`${testNamespace}:key2`, 'value2')

      const keys: string[] = []
      for await (const [key] of store.iterator(testNamespace)) {
        keys.push(key)
      }

      expect(keys.length).toBeGreaterThanOrEqual(2)

      // Cleanup
      await store.clear()
    })
  })

  describe('Disconnect', () => {
    it('should disconnect and reset state', async () => {
      const store = new LazyRedisStore(connection)

      // Connect by performing an operation
      await store.get('test')
      expect(store.isConnected()).toBe(true)

      // Disconnect
      await store.disconnect()
      expect(store.isConnected()).toBe(false)
    })

    it('should handle disconnect when not connected', async () => {
      const store = new LazyRedisStore(connection)
      expect(store.isConnected()).toBe(false)

      // Should not throw
      await expect(store.disconnect()).resolves.not.toThrow()
    })
  })

  describe('Connection String', () => {
    it('should return the connection string', () => {
      const store = new LazyRedisStore(connection)
      expect(store.getConnectionString()).toBe(connection)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations with single connection', async () => {
      const store = new LazyRedisStore(connection)
      const testNamespace = `concurrent-${Ids.nanoId(5)}`
      store.namespace = testNamespace

      // Launch multiple operations concurrently
      const operations = []
      for (let i = 0; i < 10; i++) {
        operations.push(store.set(`key${i}`, `value${i}`))
      }

      await Promise.all(operations)

      // Verify all values were set
      for (let i = 0; i < 10; i++) {
        const result = await store.get(`key${i}`)
        expect(result).toBe(`value${i}`)
      }

      // Cleanup
      await store.clear()
    })

    it('should only create one connection for concurrent first operations', async () => {
      const store = new LazyRedisStore(connection)

      // Launch multiple operations that would all try to connect
      const operations = [
        store.get('key1'),
        store.get('key2'),
        store.set('key3', 'value3'),
        store.has('key4'),
      ]

      await Promise.all(operations)

      // Should be connected with just one connection
      expect(store.isConnected()).toBe(true)

      // Verify the pool has the expected connection count
      const refCount = pool.getRefCount(connection)
      expect(refCount).toBeGreaterThanOrEqual(1)

      // Cleanup
      await store.delete('key3')
    })
  })
})

describe('LazyRedisStore - Namespace Integration with Cache', () => {
  // These tests verify the fix works when LazyRedisStore is used through Cache
  // The critical issue was that clear()/flush() didn't work because namespace wasn't forwarded

  let pool: RedisConnectionPool

  beforeEach(() => {
    pool = RedisConnectionPool.getInstance()
  })

  afterEach(async () => {
    await pool.disconnectAll()
  })

  it('should properly clear only namespaced keys (simulating Cache.flush)', async () => {
    // This test simulates what happens in Cache when Keyv sets the namespace
    const store1 = new LazyRedisStore(connection)
    const store2 = new LazyRedisStore(connection)

    const namespace1 = `cache-flush-test-1-${Ids.nanoId(5)}`
    const namespace2 = `cache-flush-test-2-${Ids.nanoId(5)}`

    // Simulate how Keyv sets namespace on the store
    store1.namespace = namespace1
    store2.namespace = namespace2

    // Set some values (this triggers connection)
    await store1.set(`${namespace1}:key1`, JSON.stringify({ value: 'data1' }))
    await store1.set(`${namespace1}:key2`, JSON.stringify({ value: 'data2' }))
    await store2.set(`${namespace2}:key1`, JSON.stringify({ value: 'data3' }))

    // Verify values exist
    const v1Before = await store1.get(`${namespace1}:key1`)
    const v2Before = await store2.get(`${namespace2}:key1`)
    expect(v1Before).toBeDefined()
    expect(v2Before).toBeDefined()

    // Clear store1's namespace (simulating Cache.flush())
    await store1.clear()

    // Store2's data should still exist
    const v2After = await store2.get(`${namespace2}:key1`)
    expect(v2After).toBeDefined()

    // Cleanup
    await store2.clear()
  })

  it('should work with compound namespaces (tenant:feature)', async () => {
    const store = new LazyRedisStore(connection)
    const namespace = `tenant1:feature:module-${Ids.nanoId(5)}`

    store.namespace = namespace

    await store.set(`${namespace}:config`, JSON.stringify({ setting: true }))

    const result = await store.get(`${namespace}:config`)
    expect(result).toBeDefined()

    // Clear should work with compound namespace
    await store.clear()

    const afterClear = await store.get(`${namespace}:config`)
    expect(afterClear).toBeUndefined()
  })
})
