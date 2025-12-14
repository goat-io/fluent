// npx vitest run ./src/cache/RedisConnectionPool.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGlobalData } from '../test/const'
import { RedisConnectionPool } from './RedisConnectionPool'

const connection = getGlobalData().redisUrl || 'redis://localhost:6379'

describe('RedisConnectionPool', () => {
  let pool: RedisConnectionPool

  beforeEach(() => {
    pool = RedisConnectionPool.getInstance()
    // Clear pool before each test
    pool.clearPool()
  })

  afterEach(async () => {
    // Clean up all connections after each test
    await pool.disconnectAll()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RedisConnectionPool.getInstance()
      const instance2 = RedisConnectionPool.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Connection Management', () => {
    it('should create a new connection when none exists', () => {
      const store = pool.getConnection(connection)
      expect(store).toBeDefined()
      expect(pool.getPoolSize()).toBe(1)
      expect(pool.getRefCount(connection)).toBe(1)
    })

    it('should reuse existing connection', () => {
      const store1 = pool.getConnection(connection)
      const store2 = pool.getConnection(connection)

      // Store instances are different (each has its own wrapper)
      expect(store1).not.toBe(store2)
      // But they share the same underlying Redis client
      // @ts-expect-error accessing private property
      const client1 = store1.redis || store1.client
      // @ts-expect-error accessing private property
      const client2 = store2.redis || store2.client
      expect(client1).toBe(client2)

      expect(pool.getPoolSize()).toBe(1)
      expect(pool.getRefCount(connection)).toBe(2)
    })

    it('should handle multiple different connections', () => {
      const conn1 = connection
      const conn2 = `${connection}/1`
      const conn3 = `${connection}/2`

      pool.getConnection(conn1)
      pool.getConnection(conn2)
      pool.getConnection(conn3)

      expect(pool.getPoolSize()).toBe(3)
      expect(pool.getRefCount(conn1)).toBe(1)
      expect(pool.getRefCount(conn2)).toBe(1)
      expect(pool.getRefCount(conn3)).toBe(1)
    })

    it('should increment ref count for multiple gets of same connection', () => {
      pool.getConnection(connection)
      pool.getConnection(connection)
      pool.getConnection(connection)

      expect(pool.getRefCount(connection)).toBe(3)
      expect(pool.getPoolSize()).toBe(1)
    })
  })

  describe('Connection Release', () => {
    it('should decrement ref count on release', () => {
      pool.getConnection(connection)
      pool.getConnection(connection)

      expect(pool.getRefCount(connection)).toBe(2)

      pool.releaseConnection(connection)
      expect(pool.getRefCount(connection)).toBe(1)

      pool.releaseConnection(connection)
      expect(pool.getRefCount(connection)).toBe(0)
    })

    it('should keep connection in pool when ref count reaches 0', () => {
      pool.getConnection(connection)
      pool.releaseConnection(connection)

      expect(pool.getRefCount(connection)).toBe(0)
      expect(pool.getPoolSize()).toBe(1)
    })

    it('should handle release of non-existent connection gracefully', () => {
      expect(() => {
        pool.releaseConnection('redis://non-existent:6379')
      }).not.toThrow()
    })
  })

  describe('Connection Disconnect', () => {
    it('should remove connection from pool on disconnect', async () => {
      pool.getConnection(connection)
      expect(pool.getPoolSize()).toBe(1)

      await pool.disconnect(connection)
      expect(pool.getPoolSize()).toBe(0)
      expect(pool.getRefCount(connection)).toBe(0)
    })

    it('should handle disconnect of non-existent connection gracefully', async () => {
      await expect(
        pool.disconnect('redis://non-existent:6379')
      ).resolves.not.toThrow()
    })

    it('should disconnect all connections', async () => {
      const conn1 = connection
      const conn2 = `${connection}/1`
      const conn3 = `${connection}/2`

      pool.getConnection(conn1)
      pool.getConnection(conn2)
      pool.getConnection(conn3)

      expect(pool.getPoolSize()).toBe(3)

      await pool.disconnectAll()
      expect(pool.getPoolSize()).toBe(0)
    })
  })

  describe('Pool Statistics', () => {
    it('should return 0 ref count for non-existent connection', () => {
      expect(pool.getRefCount('redis://non-existent:6379')).toBe(0)
    })

    it('should return correct pool size', () => {
      expect(pool.getPoolSize()).toBe(0)

      pool.getConnection(connection)
      expect(pool.getPoolSize()).toBe(1)

      pool.getConnection(`${connection}/1`)
      expect(pool.getPoolSize()).toBe(2)
    })
  })

  describe('Real Redis Connection Test', () => {
    it('should successfully connect to Redis and verify connection reuse', async () => {
      // Get connection twice
      const store1 = pool.getConnection(connection)
      const store2 = pool.getConnection(connection)

      // Store instances are different (each has its own wrapper)
      expect(store1).not.toBe(store2)
      // But they share the same underlying Redis client
      // @ts-expect-error accessing private property
      const client1 = store1.redis || store1.client
      // @ts-expect-error accessing private property
      const client2 = store2.redis || store2.client
      expect(client1).toBe(client2)

      expect(pool.getRefCount(connection)).toBe(2)

      // Clean up
      await pool.disconnect(connection)
    })
  })
})
