import { Ids } from '@goatlab/js-utils'
import { describe, expect, it } from 'vitest'
import { Cache } from './Cache'
import { getGlobalData } from './test/const'

const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

describe('Cache flush performance', () => {
  it('should use direct Redis path for flush (not fallback)', async () => {
    const namespace = `redis-path-test-${Ids.uuid()}`
    const cache = new Cache({
      connection,
      opts: { namespace },
    })

    // Create some keys
    await cache.set('test1', 'value1')

    // Verify getRedisClient returns a client
    // @ts-expect-error accessing private method
    const redis = await cache.getRedisClient()
    expect(redis).toBeDefined()
    expect(typeof redis.keys).toBe('function')
    expect(typeof redis.unlink).toBe('function')

    console.log('✓ getRedisClient() returns valid Redis client')

    // Flush and verify it's fast
    const start = Date.now()
    await cache.flush()
    const elapsed = Date.now() - start
    console.log(`Flush took: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(1000)
  })

  it('should flush quickly with direct Redis access', async () => {
    const namespace = `perf-test-${Ids.uuid()}`
    const cache = new Cache({
      connection,
      opts: { namespace },
    })

    // Create 10 keys
    console.log('Creating 10 keys...')
    for (let i = 0; i < 10; i++) {
      await cache.set(`key-${i}`, `value-${i}`)
    }

    // Verify keys exist
    const keysBefore = await cache.getValueWhereKeyStartsWith('')
    console.log(`Keys before flush: ${keysBefore.length}`)

    // Time the flush
    console.log('Flushing...')
    const start = Date.now()
    await cache.flush()
    const elapsed = Date.now() - start
    console.log(`Flush took: ${elapsed}ms`)

    // Verify keys are gone
    const keysAfter = await cache.getValueWhereKeyStartsWith('')
    console.log(`Keys after flush: ${keysAfter.length}`)

    expect(keysAfter.length).toBe(0)
    expect(elapsed).toBeLessThan(5000) // Should be under 5 seconds for 10 keys
  })

  it('should compare old vs new flush approach', async () => {
    const namespace = `compare-test-${Ids.uuid()}`
    const cache = new Cache({
      connection,
      opts: { namespace },
    })

    // Trigger connection and get Redis client
    await cache.get('__trigger__')
    // @ts-expect-error accessing private
    const lazyStore = cache.lazyStore
    // @ts-expect-error accessing private
    const keyvRedis = lazyStore._store
    const redis = keyvRedis.redis
    // @ts-expect-error accessing private
    const ns = cache.ns

    // Create keys directly in Redis (bypassing Set tracking)
    console.log('\n--- Creating 10 orphaned keys directly in Redis ---')
    for (let i = 0; i < 10; i++) {
      await redis.set(
        `${ns}:orphan-${i}`,
        JSON.stringify({ value: `val-${i}` }),
      )
    }

    // Check keys exist
    const keysBefore = await redis.keys(`${ns}:*`)
    console.log(`Keys in Redis: ${keysBefore.length}`)

    // Method 1: redis.keys + redis.unlink (our new approach)
    console.log('\n--- Method 1: redis.keys + redis.unlink ---')
    const start1 = Date.now()
    const pattern = `${ns}:*`
    const keys = await redis.keys(pattern)
    console.log(
      `  redis.keys took: ${Date.now() - start1}ms, found ${keys.length} keys`,
    )

    if (keys.length > 0) {
      const unlinkStart = Date.now()
      await redis.unlink(keys)
      console.log(`  redis.unlink took: ${Date.now() - unlinkStart}ms`)
    }
    console.log(`  Total: ${Date.now() - start1}ms`)

    // Recreate keys for next test
    for (let i = 0; i < 10; i++) {
      await redis.set(
        `${ns}:orphan-${i}`,
        JSON.stringify({ value: `val-${i}` }),
      )
    }

    // Method 2: iterator + individual deletes (old slow approach)
    console.log('\n--- Method 2: iterator + individual deletes ---')
    const start2 = Date.now()
    const keysToDelete: string[] = []
    for await (const [key] of cache.iterator!(ns)) {
      keysToDelete.push(key)
    }
    console.log(
      `  Iterator took: ${Date.now() - start2}ms, found ${keysToDelete.length} keys`,
    )

    const deleteStart = Date.now()
    for (const key of keysToDelete) {
      const keyWithoutNs = key.replace(`${ns}:`, '')
      await cache.delete(keyWithoutNs)
    }
    console.log(`  Individual deletes took: ${Date.now() - deleteStart}ms`)
    console.log(`  Total: ${Date.now() - start2}ms`)

    // Verify all gone
    const keysAfter = await redis.keys(`${ns}:*`)
    expect(keysAfter.length).toBe(0)
  })
})
