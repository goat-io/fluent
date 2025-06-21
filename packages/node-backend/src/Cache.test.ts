import { describe, it, expect } from 'vitest'
import { Cache } from './Cache'
import { KeyvLru } from 'keyv-lru'
import Keyv from 'keyv'
import { getGlobalData } from './test/const'
import { Ids } from '@goatlab/js-utils'

const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

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
