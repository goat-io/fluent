import { describe, it, expect, beforeEach, afterEach, test } from 'vitest'
import { Cache } from './Cache'
import { KeyvLru } from './cache/KeyvLrus'
import Keyv from 'keyv'
import { getGlobalData } from './test/const'
import { Ids } from '@goatlab/js-utils'

const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

// Example of typed cache usage
// type RANGA = { this: string; world: number }
// const a = new Cache<RANGA>({
//   connection,
//   opts: { namespace: 'test-ns' }
// })

describe('Cache (Memory)', () => {
  it('should initialize with Redis store when connection is provided', () => {
    const cache = new Cache({ connection, opts: { namespace: 'test-ns' } })
    expect(cache).toBeInstanceOf(Cache)
    // @ts-expect-error accessing private property for test
    expect(cache._ns).toBe('test-ns')
    // @ts-expect-error accessing private property for test
    expect(cache.usesLRUMemory).toBe(false)
    // @ts-expect-error accessing private property for test
    expect(cache.memoryCache).toBeInstanceOf(Keyv)
    // @ts-expect-error accessing private property for test
    expect(cache.keyvLru).toBeInstanceOf(KeyvLru)
  })

  it('should initialize with LRU store when connection is not provided', () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'lru-ns' }
    })
    expect(cache).toBeInstanceOf(Cache)
    // @ts-expect-error accessing private property for test
    expect(cache._ns).toBe('lru-ns')
    // @ts-expect-error accessing private property for test
    expect(cache.usesLRUMemory).toBe(false)
    // @ts-expect-error accessing private property for test
    expect(cache.memoryCache).toBeInstanceOf(Keyv)
    // @ts-expect-error accessing private property for test
    expect(cache.keyvLru).toBeInstanceOf(KeyvLru)
  })

  it('should set usesLRUMemory to true if provided in opts', () => {
    const cache = new Cache({
      connection: undefined,
      opts: { usesLRUMemory: true, namespace: 'lru-ns' }
    })
    // @ts-expect-error accessing private property for test
    expect(cache.usesLRUMemory).toBe(true)
  })

  it('should default namespace to empty string if not provided', () => {
    const cache = new Cache({ connection: undefined, opts: {} })
    // @ts-expect-error accessing private property for test
    expect(cache._ns).toBe('')
  })

  it('should handle undefined opts gracefully', () => {
    const cache = new Cache({ connection: undefined })
    // @ts-expect-error accessing private property for test
    expect(cache._ns).toBe('')
    // @ts-expect-error accessing private property for test
    expect(cache.usesLRUMemory).toBe(false)
  })

  it('should set and get values correctly', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'data-ns' }
    })
    await cache.set('foo', 'bar')
    const value = await cache.get('foo')
    expect(value).toBe('bar')
  })

  it('should delete values correctly', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'del-ns' }
    })
    await cache.set('foo', 'bar')
    const deleted = await cache.delete('foo')
    expect(deleted).toBe(true)
    const value = await cache.get('foo')
    expect(value).toBeUndefined()
  })

  it('should return true for has when value exists', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'has-ns' }
    })
    await cache.set('foo', 'bar')
    const exists = await cache.has('foo')
    expect(exists).toBe(true)
  })

  it('should return false for has when value does not exist', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'has-ns' }
    })
    const exists = await cache.has('not-exist')
    expect(exists).toBe(false)
  })

  it('should remember and cache value for given ms', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'remember-ns' }
    })
    let called = 0
    const result = await cache.remember('foo', 1000, async () => {
      called++
      return 'bar'
    })
    expect(result).toBe('bar')
    const result2 = await cache.remember('foo', 1000, async () => {
      called++
      return 'baz'
    })
    expect(result2).toBe('bar')
    expect(called).toBe(1)
  })

  it('should rememberForever and cache value', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'forever-ns' }
    })
    let called = 0
    const result = await cache.rememberForever('foo', async () => {
      called++
      return 'bar'
    })
    expect(result).toBe('bar')
    const result2 = await cache.rememberForever('foo', async () => {
      called++
      return 'baz'
    })
    expect(result2).toBe('bar')
    expect(called).toBe(1)
  })

  it('should pull value and delete it', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'pull-ns' }
    })
    await cache.set('foo', 'bar')
    const value = await cache.pull('foo')
    expect(value).toBe('bar')
    const after = await cache.get('foo')
    expect(after).toBeUndefined()
  })

  it('should forget value', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'forget-ns' }
    })
    await cache.set('foo', 'bar')
    const result = await cache.forget('foo')
    expect(result).toBe(true)
    const value = await cache.get('foo')
    expect(value).toBeUndefined()
  })

  it('should flush all values in namespace', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'flush-ns' }
    })
    await cache.set('foo', 'bar')
    await cache.set('baz', 'qux')
    await cache.flush()
    const foo = await cache.get('foo')
    const baz = await cache.get('baz')
    expect(foo).toBeUndefined()
    expect(baz).toBeUndefined()
  })

  it('should delete keys where key starts with value', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'starts-ns' }
    })
    await cache.set('start:1', 'a')
    await cache.set('start:2', 'b')
    await cache.set('other:3', 'c')
    await cache.deleteWhereStartsWith('start')
    const v1 = await cache.get('start:1')
    const v2 = await cache.get('start:2')
    const v3 = await cache.get('other:3')
    expect(v1).toBeUndefined()
    expect(v2).toBeUndefined()
    expect(v3).toBe('c')
  })

  it('should use LRU memory cache when usesLRUMemory is true', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'lru-mem', usesLRUMemory: true }
    })
    await cache.set('foo', 'bar')
    // manually set in memoryCache to test get from LRU
    // @ts-expect-error
    await cache.memoryCache.set('lru-mem:foo', 'baz')
    const value = await cache.get('foo')
    expect(value).toBe('baz')
  })
})

describe('Cache (Redis)', () => {
  let cache: Cache

  beforeEach(async () => {
    cache = new Cache({
      connection,
      opts: { namespace: `redis-ns-${Ids.nanoId(5)}` }
    })
    await cache.flush()
  })

  afterEach(async () => {
    await cache.flush()
  })

  it('should set and get values correctly with Redis', async () => {
    await cache.set('foo', 'bar')
    const value = await cache.get('foo')
    expect(value).toBe('bar')
  })

  it('should delete values correctly with Redis', async () => {
    await cache.set('foo', 'bar')
    const deleted = await cache.delete('foo')
    expect(deleted).toBe(true)
    const value = await cache.get('foo')
    expect(value).toBeUndefined()
  })

  it('should return true for has when value exists (Redis)', async () => {
    await cache.set('foo', 'bar')
    const exists = await cache.has('foo')
    expect(exists).toBe(true)
  })

  it('should return false for has when value does not exist (Redis)', async () => {
    const exists = await cache.has('not-exist')
    expect(exists).toBe(false)
  })

  it('should remember and cache value for given ms (Redis)', async () => {
    let called = 0
    const result = await cache.remember('foo', 1000, async () => {
      called++
      return 'bar'
    })
    expect(result).toBe('bar')
    const result2 = await cache.remember('foo', 1000, async () => {
      called++
      return 'baz'
    })
    expect(result2).toBe('bar')
    expect(called).toBe(1)
  })

  it('should rememberForever and cache value (Redis)', async () => {
    let called = 0
    const result = await cache.rememberForever('foo', async () => {
      called++
      return 'bar'
    })
    expect(result).toBe('bar')
    const result2 = await cache.rememberForever('foo', async () => {
      called++
      return 'baz'
    })
    expect(result2).toBe('bar')
    expect(called).toBe(1)
  })

  it('should pull value and delete it (Redis)', async () => {
    await cache.set('foo', 'bar')
    const value = await cache.pull('foo')
    expect(value).toBe('bar')
    const after = await cache.get('foo')
    expect(after).toBeUndefined()
  })

  it('should forget value (Redis)', async () => {
    await cache.set('foo', 'bar')
    const result = await cache.forget('foo')
    expect(result).toBe(true)
    const value = await cache.get('foo')
    expect(value).toBeUndefined()
  })

  it('should flush all values in namespace (Redis)', async () => {
    await cache.set('foo', 'bar')
    await cache.set('baz', 'qux')
    await cache.flush()
    const foo = await cache.get('foo')
    const baz = await cache.get('baz')
    expect(foo).toBeUndefined()
    expect(baz).toBeUndefined()
  })

  it('should delete keys where key starts with value (Redis)', async () => {
    await cache.set('start:1', 'a')
    await cache.set('start:2', 'b')
    await cache.set('other:3', 'c')
    await cache.deleteWhereStartsWith('start')
    const v1 = await cache.get('start:1')
    const v2 = await cache.get('start:2')
    const v3 = await cache.get('other:3')
    expect(v1).toBeUndefined()
    expect(v2).toBeUndefined()
    expect(v3).toBe('c')
  })

  it('should support array of keys for has (Redis)', async () => {
    await cache.set('foo', 'bar')
    await cache.set('baz', 'qux')
    const exists = await cache.has(['foo', 'baz', 'not-exist'])
    const notExists = await cache.has(['anotherKey'])
    expect(exists).toEqual([true, true, false])
    expect(notExists).toEqual([false])
  })

  it('should not cache empty or nullish values in remember (Redis)', async () => {
    let called = 0
    const result = await cache.remember('foo', 1000, async () => {
      called++
      return ''
    })
    expect(result).toBe('')
    const result2 = await cache.remember('foo', 1000, async () => {
      called++
      return 'bar'
    })
    expect(result2).toBe('bar')
    expect(called).toBe(2)
  })
})

describe('Cache (Memory) - Namespace Isolation', () => {
  it('should isolate keys between different namespaces', async () => {
    const cacheA = new Cache({
      connection: undefined,
      opts: { namespace: 'nsA' }
    })
    const cacheB = new Cache({
      connection: undefined,
      opts: { namespace: 'nsB' }
    })

    await cacheA.set('foo', 'barA')
    await cacheB.set('foo', 'barB')

    expect(await cacheA.get('foo')).toBe('barA')
    expect(await cacheB.get('foo')).toBe('barB')

    await cacheA.delete('foo')
    expect(await cacheA.get('foo')).toBeUndefined()
    expect(await cacheB.get('foo')).toBe('barB')

    await cacheB.flush()
    expect(await cacheB.get('foo')).toBeUndefined()
  })

  it('should not affect other namespaces when using remember and rememberForever', async () => {
    const cacheA = new Cache({
      connection: undefined,
      opts: { namespace: 'nsA2' }
    })
    const cacheB = new Cache({
      connection: undefined,
      opts: { namespace: 'nsB2' }
    })

    let calledA = 0
    let calledB = 0

    const valA = await cacheA.remember('foo', 1000, async () => {
      calledA++
      return 'A'
    })
    const valB = await cacheB.rememberForever('foo', async () => {
      calledB++
      return 'B'
    })

    expect(valA).toBe('A')
    expect(valB).toBe('B')
    expect(await cacheA.get('foo')).toBe('A')
    expect(await cacheB.get('foo')).toBe('B')

    // Should not affect each other
    await cacheA.forget('foo')
    expect(await cacheA.get('foo')).toBeUndefined()
    expect(await cacheB.get('foo')).toBe('B')
  })

  it('should isolate deleteWhereStartsWith between namespaces', async () => {
    const cacheA = new Cache({
      connection: undefined,
      opts: { namespace: 'nsA3' }
    })
    const cacheB = new Cache({
      connection: undefined,
      opts: { namespace: 'nsB3' }
    })

    await cacheA.set('start:1', 'a')
    await cacheA.set('start:2', 'b')
    await cacheB.set('start:1', 'c')
    await cacheB.set('other:1', 'd')

    await cacheA.deleteWhereStartsWith('start')
    expect(await cacheA.get('start:1')).toBeUndefined()
    expect(await cacheA.get('start:2')).toBeUndefined()
    expect(await cacheB.get('start:1')).toBe('c')
    expect(await cacheB.get('other:1')).toBe('d')
  })
})

describe('Cache (Redis) - Namespace Isolation', () => {
  let cacheA: Cache
  let cacheB: Cache

  beforeEach(async () => {
    cacheA = new Cache({
      connection,
      opts: { namespace: `redis-nsA-${Ids.nanoId(5)}` }
    })
    cacheB = new Cache({
      connection,
      opts: { namespace: `redis-nsB-${Ids.nanoId(5)}` }
    })
    await cacheA.flush()
    await cacheB.flush()
  })

  afterEach(async () => {
    await cacheA.flush()
    await cacheB.flush()
  })

  it('should isolate keys between different namespaces (Redis)', async () => {
    await cacheA.set('foo', 'barA')
    await cacheB.set('foo', 'barB')

    expect(await cacheA.get('foo')).toBe('barA')
    expect(await cacheB.get('foo')).toBe('barB')

    await cacheA.delete('foo')
    expect(await cacheA.get('foo')).toBeUndefined()
    expect(await cacheB.get('foo')).toBe('barB')

    await cacheB.flush()
    expect(await cacheB.get('foo')).toBeUndefined()
  })

  it('should not affect other namespaces when using remember and rememberForever (Redis)', async () => {
    let calledA = 0
    let calledB = 0

    const valA = await cacheA.remember('foo', 1000, async () => {
      calledA++
      return 'A'
    })
    const valB = await cacheB.rememberForever('foo', async () => {
      calledB++
      return 'B'
    })

    expect(valA).toBe('A')
    expect(valB).toBe('B')
    expect(await cacheA.get('foo')).toBe('A')
    expect(await cacheB.get('foo')).toBe('B')

    await cacheA.forget('foo')
    expect(await cacheA.get('foo')).toBeUndefined()
    expect(await cacheB.get('foo')).toBe('B')
  })

  it('should isolate deleteWhereStartsWith between namespaces (Redis)', async () => {
    await cacheA.set('start:1', 'a')
    await cacheA.set('start:2', 'b')
    await cacheB.set('start:1', 'c')
    await cacheB.set('other:1', 'd')

    await cacheA.deleteWhereStartsWith('start')
    expect(await cacheA.get('start:1')).toBeUndefined()
    expect(await cacheA.get('start:2')).toBeUndefined()
    expect(await cacheB.get('start:1')).toBe('c')
    expect(await cacheB.get('other:1')).toBe('d')
  })

  it('should support all functions in parallel without collision (Redis)', async () => {
    await cacheA.set('foo', 'a')
    await cacheB.set('foo', 'b')
    await cacheA.set('bar', 'a2')
    await cacheB.set('bar', 'b2')

    expect(await cacheA.has('foo')).toBe(true)
    expect(await cacheB.has('foo')).toBe(true)
    expect(await cacheA.has(['foo', 'bar', 'baz'])).toEqual([true, true, false])
    expect(await cacheB.has(['foo', 'bar', 'baz'])).toEqual([true, true, false])

    expect(await cacheA.pull('foo')).toBe('a')
    expect(await cacheA.get('foo')).toBeUndefined()
    expect(await cacheB.get('foo')).toBe('b')

    await cacheB.forget('bar')
    expect(await cacheB.get('bar')).toBeUndefined()
    expect(await cacheA.get('bar')).toBe('a2')
  })
})

describe('Cache (Memory) - LRU Memory with Namespaces', () => {
  it('should isolate LRU memory cache between namespaces', async () => {
    const cacheA = new Cache({
      connection: undefined,
      opts: { namespace: 'lruA', usesLRUMemory: true }
    })
    const cacheB = new Cache({
      connection: undefined,
      opts: { namespace: 'lruB', usesLRUMemory: true }
    })

    await cacheA.set('foo', 'barA')
    await cacheB.set('foo', 'barB')

    // @ts-expect-error
    await cacheA.memoryCache.set('lruA:foo', 'bazA')
    // @ts-expect-error
    await cacheB.memoryCache.set('lruB:foo', 'bazB')

    expect(await cacheA.get('foo')).toBe('bazA')
    expect(await cacheB.get('foo')).toBe('bazB')
  })
})

const cache = new Cache({ opts: { namespace: 'test' }, connection: undefined })
describe('CACHE - Keyv', () => {
  test('should return false if a key does not exist in the cache', async () => {
    const exists = await cache.has('key')
    expect(exists).toBe(false)
  })

  test('should check if a key exists in the cache', async () => {
    const id = Ids.uuid()
    await cache.rememberForever(id, async () => 1)

    const exists = await cache.has(id)
    expect(exists).toBe(true)
  })

  test('should retrieve a value from the cache', async () => {
    const value = await cache.remember('key', 1000, async () => 123)
    expect(value).toBe(123)
  })

  test('should retrieve and delete a value from the cache', async () => {
    const id = Ids.uuid()
    const givenValue = 123
    const returnedValue = await cache.rememberForever(
      id,
      async () => givenValue
    )

    expect(returnedValue).toBe(givenValue)

    const value = await cache.pull(id)
    expect(value).toBe(givenValue)

    const exists = await cache.has(id)
    expect(exists).toBe(false)
  })

  test('should remove a value from the cache', async () => {
    const id = Ids.uuid()
    await cache.rememberForever(id, async () => 123)
    const result = await cache.forget(id)
    expect(result).toBe(true)
  })

  test('should flush all values from the cache', async () => {
    const namespace = Ids.uuid()
    const isolatedCache = new Cache({
      opts: { namespace },
      connection: undefined
    })
    const id1 = Ids.uuid()
    const id2 = Ids.uuid()
    const id3 = Ids.uuid()
    await isolatedCache.rememberForever(id1, async () => id1)
    await isolatedCache.rememberForever(id2, async () => id2)
    await isolatedCache.rememberForever(id3, async () => id3)

    await cache.flush()

    const exists = await cache.has(id3)
    expect(exists).toBe(false)
  })
})

describe('Cache#getValueWhereKeyStartsWith', () => {
  it('should return values for keys starting with a prefix (Memory)', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'gvwksw-ns' }
    })
    await cache.set('foo:1', 'a')
    await cache.set('foo:2', 'b')
    await cache.set('bar:1', 'c')

    const values = await cache.getValueWhereKeyStartsWith('foo')
    expect(values).toContain('a')
    expect(values).toContain('b')
    expect(values).not.toContain('c')
    expect(values.length).toBe(2)
  })

  it('should return an empty array if no keys match (Memory)', async () => {
    const cache = new Cache({
      connection: undefined,
      opts: { namespace: 'gvwksw-empty' }
    })
    await cache.set('foo:1', 'a')
    const values = await cache.getValueWhereKeyStartsWith('bar')
    expect(Array.isArray(values)).toBe(true)
    expect(values.length).toBe(0)
  })

  it('should isolate values between namespaces (Memory)', async () => {
    const cacheA = new Cache({
      connection: undefined,
      opts: { namespace: 'gvwksw-nsA' }
    })
    const cacheB = new Cache({
      connection: undefined,
      opts: { namespace: 'gvwksw-nsB' }
    })
    await cacheA.set('foo:1', 'a')
    await cacheB.set('foo:1', 'b')

    const valuesA = await cacheA.getValueWhereKeyStartsWith('foo')
    const valuesB = await cacheB.getValueWhereKeyStartsWith('foo')
    expect(valuesA).toEqual(['a'])
    expect(valuesB).toEqual(['b'])
  })

  describe('with Redis', () => {
    const connection = getGlobalData().redisUrl || 'redis://localhost:6379'
    let cache: Cache

    beforeEach(async () => {
      cache = new Cache({
        connection,
        opts: { namespace: `gvwksw-redis-${Ids.nanoId(5)}` }
      })
      await cache.flush()
    })

    afterEach(async () => {
      await cache.flush()
    })

    it('should return values for keys starting with a prefix (Redis)', async () => {
      await cache.set('foo:1', 'a')
      await cache.set('foo:2', 'b')
      await cache.set('bar:1', 'c')

      const values = await cache.getValueWhereKeyStartsWith('foo')
      expect(values).toContain('a')
      expect(values).toContain('b')
      expect(values).not.toContain('c')
      expect(values.length).toBe(2)
    })

    it('should return an empty array if no keys match (Redis)', async () => {
      await cache.set('foo:1', 'a')
      const values = await cache.getValueWhereKeyStartsWith('bar')
      expect(Array.isArray(values)).toBe(true)
      expect(values.length).toBe(0)
    })

    it('should isolate values between namespaces (Redis)', async () => {
      const cacheA = new Cache({
        connection,
        opts: { namespace: `gvwksw-redisA-${Ids.nanoId(5)}` }
      })
      const cacheB = new Cache({
        connection,
        opts: { namespace: `gvwksw-redisB-${Ids.nanoId(5)}` }
      })
      await cacheA.set('foo:1', 'a')
      await cacheB.set('foo:1', 'b')

      const valuesA = await cacheA.getValueWhereKeyStartsWith('foo')
      const valuesB = await cacheB.getValueWhereKeyStartsWith('foo')
      expect(valuesA).toEqual(['a'])
      expect(valuesB).toEqual(['b'])
      
      await cacheA.flush()
      await cacheB.flush()
    }, 10000)
  })
  describe('Cache#getValueWhereKeyStartsWith - complex objects', () => {
    it('should return complex objects for keys starting with a prefix (Memory)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'gvwksw-complex' }
      })
      const obj1 = { a: 1, b: [1, 2, 3], c: { d: 'test' } }
      const obj2 = { x: 42, y: { z: [4, 5] } }
      await cache.set('foo:1', obj1)
      await cache.set('foo:2', obj2)
      await cache.set('bar:1', { not: 'included' })

      const values = await cache.getValueWhereKeyStartsWith('foo')
      expect(values).toEqual(expect.arrayContaining([obj1, obj2]))
      expect(values).not.toContainEqual({ not: 'included' })
      expect(values.length).toBe(2)
      expect(values[0]).toHaveProperty('a')
      expect(values[1]).toHaveProperty('x')
    })

    it('should return an empty array if no complex objects match (Memory)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'gvwksw-complex-empty' }
      })
      await cache.set('foo:1', { a: 1 })
      const values = await cache.getValueWhereKeyStartsWith('bar')
      expect(Array.isArray(values)).toBe(true)
      expect(values.length).toBe(0)
    })

    it('should isolate complex objects between namespaces (Memory)', async () => {
      const cacheA = new Cache({
        connection: undefined,
        opts: { namespace: 'gvwksw-complexA' }
      })
      const cacheB = new Cache({
        connection: undefined,
        opts: { namespace: 'gvwksw-complexB' }
      })
      const objA = { foo: 'A', arr: [1, 2] }
      const objB = { foo: 'B', arr: [3, 4] }
      await cacheA.set('foo:1', objA)
      await cacheB.set('foo:1', objB)

      const valuesA = await cacheA.getValueWhereKeyStartsWith('foo')
      const valuesB = await cacheB.getValueWhereKeyStartsWith('foo')
      expect(valuesA).toEqual([objA])
      expect(valuesB).toEqual([objB])
    })

    describe('with Redis - complex objects', () => {
      const connection = getGlobalData().redisUrl || 'redis://localhost:6379'
      let cache: Cache

      beforeEach(async () => {
        cache = new Cache({
          connection,
          opts: { namespace: `gvwksw-redis-complex-${Ids.nanoId(5)}` }
        })
        await cache.flush()
      })

      afterEach(async () => {
        await cache.flush()
      })

      it('should return complex objects for keys starting with a prefix (Redis)', async () => {
        const obj1 = { a: 1, b: [1, 2, 3], c: { d: 'test' } }
        const obj2 = { x: 42, y: { z: [4, 5] } }
        await cache.set('foo:1', obj1)
        await cache.set('foo:2', obj2)
        await cache.set('bar:1', { not: 'included' })

        const values = await cache.getValueWhereKeyStartsWith('foo')
        expect(values).toEqual(expect.arrayContaining([obj1, obj2]))
        expect(values).not.toContainEqual({ not: 'included' })
        expect(values.length).toBe(2)
      })

      it('should return an empty array if no complex objects match (Redis)', async () => {
        await cache.set('foo:1', { a: 1 })
        const values = await cache.getValueWhereKeyStartsWith('bar')
        expect(Array.isArray(values)).toBe(true)
        expect(values.length).toBe(0)
      })

      it('should isolate complex objects between namespaces (Redis)', async () => {
        const cacheA = new Cache({
          connection,
          opts: { namespace: `gvwksw-redis-complexA-${Ids.nanoId(5)}` }
        })
        const cacheB = new Cache({
          connection,
          opts: { namespace: `gvwksw-redis-complexB-${Ids.nanoId(5)}` }
        })
        const objA = { foo: 'A', arr: [1, 2] }
        const objB = { foo: 'B', arr: [3, 4] }
        await cacheA.set('foo:1', objA)
        await cacheB.set('foo:1', objB)

        const valuesA = await cacheA.getValueWhereKeyStartsWith('foo')
        const valuesB = await cacheB.getValueWhereKeyStartsWith('foo')
        expect(valuesA).toEqual([objA])
        expect(valuesB).toEqual([objB])
      })
    })
  })
})

describe('Cache - Multi-tenancy Support', () => {
  describe('Basic multi-tenancy functionality', () => {
    it('should initialize with tenantId', () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'ns1' }
      })
      expect(cache).toBeInstanceOf(Cache)
      expect(cache.tenantId).toBe('tenant1')
      // @ts-expect-error accessing private property for test
      expect(cache._ns).toBe('tenant1:ns1')
    })

    it('should initialize with tenantId but no namespace', () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1' }
      })
      expect(cache.tenantId).toBe('tenant1')
      // @ts-expect-error accessing private property for test
      expect(cache._ns).toBe('tenant1')
    })

    it('should work without tenantId (backward compatibility)', () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'ns1' }
      })
      expect(cache.tenantId).toBeUndefined()
      // @ts-expect-error accessing private property for test
      expect(cache._ns).toBe('ns1')
    })
  })

  describe('Multi-tenant isolation (Memory)', () => {
    it('should isolate data between different tenants with same namespace', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'shared' }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'shared' }
      })

      await cacheTenant1.set('key', 'value1')
      await cacheTenant2.set('key', 'value2')

      expect(await cacheTenant1.get('key')).toBe('value1')
      expect(await cacheTenant2.get('key')).toBe('value2')
    })

    it('should isolate data between different tenants without namespace', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1' }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2' }
      })

      await cacheTenant1.set('key', 'value1')
      await cacheTenant2.set('key', 'value2')

      expect(await cacheTenant1.get('key')).toBe('value1')
      expect(await cacheTenant2.get('key')).toBe('value2')
    })

    it('should support all cache operations with tenantId', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'ops' }
      })

      // Test set/get
      await cache.set('foo', 'bar')
      expect(await cache.get('foo')).toBe('bar')

      // Test has
      expect(await cache.has('foo')).toBe(true)
      expect(await cache.has('nonexistent')).toBe(false)

      // Test remember
      let called = 0
      const remembered = await cache.remember('rem', 1000, async () => {
        called++
        return 'remembered'
      })
      expect(remembered).toBe('remembered')
      expect(called).toBe(1)

      // Test rememberForever
      const forever = await cache.rememberForever('forever', async () => 'forever-value')
      expect(forever).toBe('forever-value')

      // Test pull
      await cache.set('pull-key', 'pull-value')
      const pulled = await cache.pull('pull-key')
      expect(pulled).toBe('pull-value')
      expect(await cache.get('pull-key')).toBeUndefined()

      // Test forget
      await cache.set('forget-key', 'forget-value')
      await cache.forget('forget-key')
      expect(await cache.get('forget-key')).toBeUndefined()

      // Test deleteWhereStartsWith
      await cache.set('prefix:1', 'a')
      await cache.set('prefix:2', 'b')
      await cache.set('other:1', 'c')
      await cache.deleteWhereStartsWith('prefix')
      expect(await cache.get('prefix:1')).toBeUndefined()
      expect(await cache.get('prefix:2')).toBeUndefined()
      expect(await cache.get('other:1')).toBe('c')

      // Test flush
      await cache.set('flush1', 'value1')
      await cache.set('flush2', 'value2')
      await cache.flush()
      expect(await cache.get('flush1')).toBeUndefined()
      expect(await cache.get('flush2')).toBeUndefined()
    })

    it('should isolate flush operations between tenants', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'flush-test' }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'flush-test' }
      })

      await cacheTenant1.set('key', 'value1')
      await cacheTenant2.set('key', 'value2')

      await cacheTenant1.flush()

      expect(await cacheTenant1.get('key')).toBeUndefined()
      expect(await cacheTenant2.get('key')).toBe('value2')
    })

    it('should isolate deleteWhereStartsWith between tenants', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'prefix-test' }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'prefix-test' }
      })

      await cacheTenant1.set('prefix:1', 'tenant1-a')
      await cacheTenant1.set('prefix:2', 'tenant1-b')
      await cacheTenant2.set('prefix:1', 'tenant2-a')
      await cacheTenant2.set('prefix:2', 'tenant2-b')

      await cacheTenant1.deleteWhereStartsWith('prefix')

      expect(await cacheTenant1.get('prefix:1')).toBeUndefined()
      expect(await cacheTenant1.get('prefix:2')).toBeUndefined()
      expect(await cacheTenant2.get('prefix:1')).toBe('tenant2-a')
      expect(await cacheTenant2.get('prefix:2')).toBe('tenant2-b')
    })

    it('should isolate getValueWhereKeyStartsWith between tenants', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'values-test' }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'values-test' }
      })

      await cacheTenant1.set('prefix:1', 'tenant1-a')
      await cacheTenant1.set('prefix:2', 'tenant1-b')
      await cacheTenant2.set('prefix:1', 'tenant2-a')
      await cacheTenant2.set('prefix:2', 'tenant2-b')

      const values1 = await cacheTenant1.getValueWhereKeyStartsWith('prefix')
      const values2 = await cacheTenant2.getValueWhereKeyStartsWith('prefix')

      expect(values1).toContain('tenant1-a')
      expect(values1).toContain('tenant1-b')
      expect(values1).not.toContain('tenant2-a')
      expect(values1).not.toContain('tenant2-b')

      expect(values2).toContain('tenant2-a')
      expect(values2).toContain('tenant2-b')
      expect(values2).not.toContain('tenant1-a')
      expect(values2).not.toContain('tenant1-b')
    })
  })

  describe('Multi-tenant isolation with LRU memory', () => {
    it('should isolate LRU memory cache between tenants', async () => {
      const cacheTenant1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'lru', usesLRUMemory: true }
      })
      const cacheTenant2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'lru', usesLRUMemory: true }
      })

      await cacheTenant1.set('key', 'value1')
      await cacheTenant2.set('key', 'value2')

      // @ts-expect-error accessing private property for test
      await cacheTenant1.memoryCache.set('tenant1:lru:key', 'memory1')
      // @ts-expect-error accessing private property for test
      await cacheTenant2.memoryCache.set('tenant2:lru:key', 'memory2')

      expect(await cacheTenant1.get('key')).toBe('memory1')
      expect(await cacheTenant2.get('key')).toBe('memory2')
    })
  })

  describe('Multi-tenant isolation (Redis)', () => {
    const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

    it('should isolate data between different tenants with same namespace', async () => {
      const cacheTenant1 = new Cache({
        connection,
        opts: { tenantId: 'redis-tenant1', namespace: 'shared' }
      })
      const cacheTenant2 = new Cache({
        connection,
        opts: { tenantId: 'redis-tenant2', namespace: 'shared' }
      })

      await cacheTenant1.set('key', 'value1')
      await cacheTenant2.set('key', 'value2')

      expect(await cacheTenant1.get('key')).toBe('value1')
      expect(await cacheTenant2.get('key')).toBe('value2')

      await cacheTenant1.flush()
      await cacheTenant2.flush()
    })

    it('should support all operations with tenantId in Redis', async () => {
      const cache = new Cache({
        connection,
        opts: { tenantId: 'redis-tenant-ops', namespace: 'ops' }
      })

      // Test basic operations
      await cache.set('foo', 'bar')
      expect(await cache.get('foo')).toBe('bar')
      expect(await cache.has('foo')).toBe(true)

      // Test complex operations
      await cache.set('prefix:1', 'a')
      await cache.set('prefix:2', 'b')
      await cache.set('other:1', 'c')

      // Test complex operations
      const values = await cache.getValueWhereKeyStartsWith('prefix')
      expect(values).toContain('a')
      expect(values).toContain('b')
      expect(values).not.toContain('c')

      await cache.deleteWhereStartsWith('prefix')
      expect(await cache.get('prefix:1')).toBeUndefined()
      expect(await cache.get('prefix:2')).toBeUndefined()
      expect(await cache.get('other:1')).toBe('c')

      await cache.flush()
    })

    it('should isolate complex operations between tenants in Redis', async () => {
      const cacheTenant1 = new Cache({
        connection,
        opts: { tenantId: 'redis-complex-tenant1', namespace: 'complex' }
      })
      const cacheTenant2 = new Cache({
        connection,
        opts: { tenantId: 'redis-complex-tenant2', namespace: 'complex' }
      })

      const obj1 = { tenant: 1, data: [1, 2, 3] }
      const obj2 = { tenant: 2, data: [4, 5, 6] }

      await cacheTenant1.set('obj', obj1)
      await cacheTenant2.set('obj', obj2)

      expect(await cacheTenant1.get('obj')).toEqual(obj1)
      expect(await cacheTenant2.get('obj')).toEqual(obj2)

      await cacheTenant1.flush()
      await cacheTenant2.flush()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty tenantId gracefully', () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: '', namespace: 'ns' }
      })
      // @ts-expect-error accessing private property for test
      expect(cache._ns).toBe('ns')
      expect(cache.tenantId).toBe('')
    })

    it('should handle tenantId with special characters', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant:with:colons', namespace: 'ns' }
      })
      await cache.set('key', 'value')
      expect(await cache.get('key')).toBe('value')
    })

    it('should maintain isolation with complex tenantId and namespace combinations', async () => {
      const cache1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'org1', namespace: 'app:module' }
      })
      const cache2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'org2', namespace: 'app:module' }
      })

      await cache1.set('config:setting', { value: 'org1-setting' })
      await cache2.set('config:setting', { value: 'org2-setting' })

      expect(await cache1.get('config:setting')).toEqual({ value: 'org1-setting' })
      expect(await cache2.get('config:setting')).toEqual({ value: 'org2-setting' })
    })

    it('should handle special characters in tenantId safely', async () => {
      const specialChars = ['@', '#', '$', '%', '&', '*', '!', '~', '^']
      
      for (const char of specialChars) {
        const cache = new Cache({
          connection: undefined,
          opts: { tenantId: `tenant${char}123`, namespace: 'test' }
        })
        
        await cache.set('key', `value-${char}`)
        expect(await cache.get('key')).toBe(`value-${char}`)
        await cache.flush()
      }
    })

    it('should handle very long tenantIds', async () => {
      const longTenantId = 'tenant_' + 'x'.repeat(100)
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: longTenantId, namespace: 'test' }
      })
      
      await cache.set('key', 'value')
      expect(await cache.get('key')).toBe('value')
    })

    it('should handle Unicode characters in tenantId', async () => {
      const cache1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant_😀_こんにちは', namespace: 'test' }
      })
      const cache2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant_🎉_مرحبا', namespace: 'test' }
      })
      
      await cache1.set('key', 'emoji-japanese')
      await cache2.set('key', 'emoji-arabic')
      
      expect(await cache1.get('key')).toBe('emoji-japanese')
      expect(await cache2.get('key')).toBe('emoji-arabic')
    })
  })

  describe('Additional multi-tenancy edge cases', () => {
    it('should handle has() with arrays across tenants', async () => {
      const cache1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'array-test' }
      })
      const cache2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'array-test' }
      })
      
      await cache1.set('key1', 'value1')
      await cache1.set('key2', 'value2')
      await cache2.set('key1', 'value1')
      
      const results1 = await cache1.has(['key1', 'key2', 'key3'])
      const results2 = await cache2.has(['key1', 'key2', 'key3'])
      
      expect(results1).toEqual([true, true, false])
      expect(results2).toEqual([true, false, false])
    })

    it('should handle TTL correctly with multi-tenancy', async () => {
      const cache1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'ttl-test' }
      })
      const cache2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'ttl-test' }
      })
      
      await cache1.set('ttl-key', 'value1', 100) // 100ms TTL
      await cache2.set('ttl-key', 'value2', 200) // 200ms TTL
      
      // Immediately both should exist
      expect(await cache1.get('ttl-key')).toBe('value1')
      expect(await cache2.get('ttl-key')).toBe('value2')
      
      // After 150ms, cache1 should expire but cache2 should still exist
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(await cache1.get('ttl-key')).toBeUndefined()
      expect(await cache2.get('ttl-key')).toBe('value2')
      
      // After another 100ms, cache2 should also expire
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(await cache2.get('ttl-key')).toBeUndefined()
    })

    it('should handle circular references gracefully', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'circular' }
      })
      
      const obj: any = { a: 1 }
      obj.circular = obj // Create circular reference
      
      // This should either handle it gracefully or throw a meaningful error
      try {
        await cache.set('circular', obj)
        const result = await cache.get('circular')
        // If it succeeds, it should have handled the circular reference
        expect(result).toBeDefined()
      } catch (error) {
        // If it fails, it should be a serialization error
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toMatch(/circular|converting|stack/i)
      }
    })

    it('should not cache invalid values with multi-tenancy', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'validation' }
      })
      
      // Test various invalid values that shouldn't be cached
      const invalidValues = [
        null,
        undefined,
        '',
        '   ', // whitespace only
        [],
        {},
        { a: null, b: null } // object with all null values
      ]
      
      for (const [index, value] of invalidValues.entries()) {
        await cache.remember(`key${index}`, 1000, async () => value as any)
        // These values should not be cached according to isValidResult
        const retrieved = await cache.get(`key${index}`)
        expect(retrieved).toBeUndefined()
      }
      
      // Valid values should be cached
      await cache.remember('valid', 1000, async () => ({ a: 1 }))
      expect(await cache.get('valid')).toEqual({ a: 1 })
    })

    it('should handle concurrent operations on same keys across tenants', async () => {
      const cache1 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1', namespace: 'concurrent' }
      })
      const cache2 = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant2', namespace: 'concurrent' }
      })
      
      // Simulate concurrent operations
      const promises: Promise<any>[] = []
      
      for (let i = 0; i < 10; i++) {
        promises.push(cache1.set(`key${i}`, `tenant1-${i}`))
        promises.push(cache2.set(`key${i}`, `tenant2-${i}`))
      }
      
      await Promise.all(promises)
      
      // Verify isolation is maintained
      for (let i = 0; i < 10; i++) {
        expect(await cache1.get(`key${i}`)).toBe(`tenant1-${i}`)
        expect(await cache2.get(`key${i}`)).toBe(`tenant2-${i}`)
      }
    })

    it('should handle namespace-only operations correctly with tenantId', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { tenantId: 'tenant1' }
      })
      
      await cache.set('simple', 'value')
      await cache.set('prefix:1', 'prefixed')
      
      expect(await cache.get('simple')).toBe('value')
      expect(await cache.get('prefix:1')).toBe('prefixed')
      
      const values = await cache.getValueWhereKeyStartsWith('prefix')
      expect(values).toContain('prefixed')
    })
  })

  describe('Multi-tenancy with Redis - Additional Tests', () => {
    const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

    it('should handle special characters in tenantId with Redis', async () => {
      const cache = new Cache({
        connection,
        opts: { tenantId: 'tenant@#$%', namespace: 'special' }
      })
      
      await cache.set('key', 'special-value')
      expect(await cache.get('key')).toBe('special-value')
      
      await cache.flush()
    })

    it('should handle array operations with multi-tenancy in Redis', async () => {
      const cache1 = new Cache({
        connection,
        opts: { tenantId: 'redis-tenant1', namespace: 'array' }
      })
      const cache2 = new Cache({
        connection,
        opts: { tenantId: 'redis-tenant2', namespace: 'array' }
      })
      
      await cache1.set('k1', 'v1')
      await cache1.set('k2', 'v2')
      await cache2.set('k1', 'v1')
      await cache2.set('k3', 'v3')
      
      const get1 = await cache1.get(['k1', 'k2', 'k3'])
      const get2 = await cache2.get(['k1', 'k2', 'k3'])
      
      expect(get1).toEqual(['v1', 'v2', undefined])
      expect(get2).toEqual(['v1', undefined, 'v3'])
      
      await cache1.flush()
      await cache2.flush()
    })
  })
})

describe('Missing Test Coverage', () => {
  describe('LRU Memory Path', () => {
    it('should write to memoryCache after cache miss and backing store fetch', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'lru-write', usesLRUMemory: true }
      })
      
      // Set directly in backing store, not in memory cache
      await cache.set('key', 'value')
      
      // Clear memory cache to simulate a miss
      // @ts-expect-error accessing private property
      await cache.memoryCache.delete('lru-write:key')
      
      // Get should fetch from backing store and write to memory cache
      const value = await cache.get('key')
      expect(value).toBe('value')
      
      // Verify it's now in memory cache
      // @ts-expect-error accessing private property
      const memValue = await cache.memoryCache.get('lru-write:key')
      expect(memValue).toBe('value')
    })

    it('should evict from memoryCache on delete when usesLRUMemory is true', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'lru-delete', usesLRUMemory: true }
      })
      
      await cache.set('key', 'value')
      
      // Get to populate memory cache
      await cache.get('key')
      
      // Verify it's in memory cache
      // @ts-expect-error accessing private property
      let memValue = await cache.memoryCache.get('lru-delete:key')
      expect(memValue).toBe('value')
      
      // Delete should evict from both stores
      await cache.delete('key')
      
      // Verify it's gone from memory cache
      // @ts-expect-error accessing private property
      memValue = await cache.memoryCache.get('lru-delete:key')
      expect(memValue).toBeUndefined()
    })
  })

  describe('Array/Object values with has()', () => {
    it('should return array of booleans for has() when cached value is an array', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'array-has' }
      })
      
      const arrayValue = ['item1', '', null, 'item4']
      await cache.set('arr-key', arrayValue)
      
      const hasResult = await cache.has('arr-key')
      // isValidResult for each array element
      expect(hasResult).toEqual([true, false, false, true])
    })

    it('should return true for has() when object has some null properties', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'obj-has' }
      })
      
      const objWithNulls = { a: 1, b: null, c: 'value', d: null }
      await cache.set('obj-key', objWithNulls)
      
      const hasResult = await cache.has('obj-key')
      expect(hasResult).toBe(true) // Has non-null values
    })
  })

  describe('Batch operations (Memory)', () => {
    it('should get array of values for array of keys (memory store)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'batch-get' }
      })
      
      await cache.set('k1', 'v1')
      await cache.set('k2', 'v2')
      
      const values = await cache.get(['k1', 'k2', 'k3'])
      expect(values).toEqual(['v1', 'v2', undefined])
    })

    it('should return array of booleans for has() with array of keys (memory store)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'batch-has' }
      })
      
      await cache.set('k1', 'v1')
      await cache.set('k2', 'v2')
      
      const results = await cache.has(['k1', 'missing', 'k2'])
      expect(results).toEqual([true, false, true])
    })
  })

  describe('Edge returns', () => {
    it('should return undefined for pull() on missing key', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'pull-missing' }
      })
      
      const value = await cache.pull('missing')
      expect(value).toBeUndefined()
    })

    it('should return false for forget() on missing key', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'forget-missing' }
      })
      
      const result = await cache.forget('missing')
      expect(result).toBe(false)
    })
  })

  describe('TTL with non-tenant cache', () => {
    it('should expire key after TTL in memory store', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'ttl-expire' }
      })
      
      await cache.set('ttl-key', 'value', 50) // 50ms TTL
      
      // Should exist immediately
      expect(await cache.get('ttl-key')).toBe('value')
      
      // Should expire after TTL
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(await cache.get('ttl-key')).toBeUndefined()
    })

    it('should expire key after TTL with LRU memory', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'ttl-lru', usesLRUMemory: true }
      })
      
      await cache.set('ttl-key', 'value', 50) // 50ms TTL
      
      // Should exist immediately
      expect(await cache.get('ttl-key')).toBe('value')
      
      // Should expire after TTL in backing store
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Clear memory cache to force fetch from backing store
      // @ts-expect-error accessing private property
      await cache.memoryCache.delete('ttl-lru:ttl-key')
      
      expect(await cache.get('ttl-key')).toBeUndefined()
    })
  })

  describe('Concurrency', () => {
    it('should demonstrate race conditions in concurrent remember() calls', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'concurrent-remember' }
      })
      
      let callCount = 0
      const slowFetch = async () => {
        const currentCount = ++callCount
        await new Promise(resolve => setTimeout(resolve, 50))
        return `result-${currentCount}`
      }
      
      // Launch two concurrent remember calls
      const [result1, result2] = await Promise.all([
        cache.remember('same-key', 1000, slowFetch),
        cache.remember('same-key', 1000, slowFetch)
      ])
      
      // Without concurrency protection, both may execute
      // The first to complete wins and gets cached
      expect(['result-1', 'result-2']).toContain(result1)
      expect(['result-1', 'result-2']).toContain(result2)
      
      // Both calls may execute due to race condition
      expect(callCount).toBeGreaterThanOrEqual(1)
      expect(callCount).toBeLessThanOrEqual(2)
      
      // Future calls should use cached value (whichever won the race)
      const result3 = await cache.remember('same-key', 1000, slowFetch)
      expect([result1, result2]).toContain(result3) // Should match one of the cached results
    })
  })

  describe('Compound namespaces edge cases', () => {
    it('should handle deleteWhereStartsWith with compound namespace (Memory)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'tenant:sub:module' }
      })
      
      await cache.set('prefix:1', 'a')
      await cache.set('prefix:2', 'b')
      await cache.set('other:1', 'c')
      
      await cache.deleteWhereStartsWith('prefix')
      
      expect(await cache.get('prefix:1')).toBeUndefined()
      expect(await cache.get('prefix:2')).toBeUndefined()
      expect(await cache.get('other:1')).toBe('c')
    })

    it('should handle getValueWhereKeyStartsWith with compound namespace (Memory)', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'org:app:module' }
      })
      
      await cache.set('config:1', 'value1')
      await cache.set('config:2', 'value2')
      await cache.set('data:1', 'value3')
      
      const values = await cache.getValueWhereKeyStartsWith('config')
      expect(values).toContain('value1')
      expect(values).toContain('value2')
      expect(values).not.toContain('value3')
    })

    it('should handle compound namespace operations with Redis', async () => {
      const connection = getGlobalData().redisUrl || 'redis://localhost:6379'
      const cache = new Cache({
        connection,
        opts: { namespace: 'company:product:feature' }
      })
      
      await cache.set('setting:1', 'val1')
      await cache.set('setting:2', 'val2')
      await cache.set('config:1', 'val3')
      
      const values = await cache.getValueWhereKeyStartsWith('setting')
      expect(values).toContain('val1')
      expect(values).toContain('val2')
      expect(values).not.toContain('val3')
      
      await cache.deleteWhereStartsWith('setting')
      expect(await cache.get('setting:1')).toBeUndefined()
      expect(await cache.get('setting:2')).toBeUndefined()
      expect(await cache.get('config:1')).toBe('val3')
      
      await cache.flush()
    })
  })

  describe('Invalid value caching', () => {
    it('should not cache empty arrays in remember()', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'invalid-array' }
      })
      
      let callCount = 0
      const result1 = await cache.remember('empty-arr', 1000, async () => {
        callCount++
        return [] as any
      })
      
      expect(result1).toEqual([])
      expect(callCount).toBe(1)
      
      // Should call function again since empty array wasn't cached
      const result2 = await cache.remember('empty-arr', 1000, async () => {
        callCount++
        return ['not-empty'] as any
      })
      
      expect(result2).toEqual(['not-empty'])
      expect(callCount).toBe(2)
    })

    it('should not cache objects with all null properties in rememberForever()', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'invalid-obj' }
      })
      
      let callCount = 0
      const result1 = await cache.rememberForever('null-obj', async () => {
        callCount++
        return { a: null, b: null, c: null } as any
      })
      
      expect(result1).toEqual({ a: null, b: null, c: null })
      expect(callCount).toBe(1)
      
      // Should call function again since object with all nulls wasn't cached
      const result2 = await cache.rememberForever('null-obj', async () => {
        callCount++
        return { a: 1, b: null } as any
      })
      
      expect(result2).toEqual({ a: 1, b: null })
      expect(callCount).toBe(2)
    })
  })

  describe('Final edge cases', () => {
    it('should expire TTL on Redis', async () => {
      const cache = new Cache({
        connection,
        opts: { namespace: `ttl-redis-${Ids.nanoId(5)}` }
      })
      
      await cache.set('ttl-key', 'value', 50) // 50ms TTL
      
      // Should exist immediately
      expect(await cache.get('ttl-key')).toBe('value')
      
      // Should expire after TTL
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(await cache.get('ttl-key')).toBeUndefined()
      
      await cache.flush()
    })

    it('should verify set() does not populate memoryCache with usesLRUMemory', async () => {
      const cache = new Cache({
        connection: undefined,
        opts: { namespace: 'lru-set-test', usesLRUMemory: true }
      })
      
      // Set a value
      await cache.set('key', 'value')
      
      // Memory cache should NOT have the value yet
      // @ts-expect-error accessing private property
      const memValue = await cache.memoryCache.get('lru-set-test:key')
      expect(memValue).toBeUndefined()
      
      // After get(), memory cache should be populated
      const getValue = await cache.get('key')
      expect(getValue).toBe('value')
      
      // Now memory cache should have it
      // @ts-expect-error accessing private property
      const memValueAfterGet = await cache.memoryCache.get('lru-set-test:key')
      expect(memValueAfterGet).toBe('value')
    })
  })
})
