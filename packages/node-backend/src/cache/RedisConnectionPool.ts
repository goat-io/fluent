// npx vitest run ./src/cache/RedisConnectionPool.test.ts
import KeyvRedis from '@keyv/redis'

interface PoolEntry {
  client: any // Redis client instance
  refCount: number
}

/**
 * Singleton connection pool for Redis connections.
 * Ensures multiple Cache instances pointing to the same Redis instance
 * share the same underlying Redis client, avoiding connection exhaustion.
 * Each Cache gets its own KeyvRedis wrapper but shares the client.
 */
export class RedisConnectionPool {
  private static instance: RedisConnectionPool
  private pool: Map<string, PoolEntry> = new Map()

  private constructor() {}

  public static getInstance(): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool()
    }
    return RedisConnectionPool.instance
  }

  /**
   * Get a Redis store from the pool. Creates a new KeyvRedis instance that uses
   * a shared Redis client if one exists, or creates a new client if not.
   * @param connectionString The Redis connection string
   * @returns KeyvRedis store instance
   */
  public getConnection(connectionString: string): KeyvRedis {
    const entry = this.pool.get(connectionString)

    if (entry) {
      entry.refCount++
      // Create a new KeyvRedis instance that uses the existing client
      return new KeyvRedis(entry.client)
    }

    // Create new connection - KeyvRedis will create the Redis client
    const store = new KeyvRedis(connectionString)
    // @ts-expect-error - accessing private property to get the client
    const client = store.redis || store.client

    this.pool.set(connectionString, {
      client,
      refCount: 1
    })

    return store
  }

  /**
   * Release a Redis connection. When reference count reaches 0,
   * the connection is kept in the pool for reuse.
   * @param connectionString The Redis connection string
   */
  public releaseConnection(connectionString: string): void {
    const entry = this.pool.get(connectionString)

    if (!entry) {
      return
    }

    entry.refCount--

    // We keep the connection in the pool even when refCount reaches 0
    // for potential reuse. Use disconnect() to actually remove it.
  }

  /**
   * Disconnect and remove a connection from the pool.
   * This should be called when you're certain no more instances will need this connection.
   * @param connectionString The Redis connection string
   */
  public async disconnect(connectionString: string): Promise<void> {
    const entry = this.pool.get(connectionString)

    if (!entry) {
      return
    }

    // Disconnect the Redis client
    if (entry.client) {
      if (typeof entry.client.disconnect === 'function') {
        await entry.client.disconnect()
      } else if (typeof entry.client.quit === 'function') {
        await entry.client.quit()
      }
    }

    this.pool.delete(connectionString)
  }

  /**
   * Disconnect all connections in the pool.
   * Useful for cleanup during application shutdown.
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.pool.keys()).map(key =>
      this.disconnect(key)
    )
    await Promise.all(disconnectPromises)
  }

  /**
   * Get the reference count for a connection.
   * Useful for testing and debugging.
   * @param connectionString The Redis connection string
   */
  public getRefCount(connectionString: string): number {
    return this.pool.get(connectionString)?.refCount || 0
  }

  /**
   * Get the number of connections in the pool.
   * Useful for testing and debugging.
   */
  public getPoolSize(): number {
    return this.pool.size
  }

  /**
   * Clear the pool without disconnecting.
   * Only use this for testing purposes.
   */
  public clearPool(): void {
    this.pool.clear()
  }
}
