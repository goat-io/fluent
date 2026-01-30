import Redis from 'ioredis'

/**
 * Singleton Redis connection pool keyed by endpoint URL.
 * Creates ONE Redis connection per unique endpoint, reused across all
 * dispatch cycles within a Cloud Run instance.
 *
 * Key insight: connections scale O(unique_redis_endpoints), not O(tenants).
 * With per-tenant Redis, each unique Redis URL gets one connection.
 * Most deployments share 1-5 Redis endpoints across all tenants.
 */
export class RedisConnectionPool {
  private readonly pools = new Map<string, Redis>()

  constructor(
    private readonly logger?: {
      debug: (...args: any[]) => void
      error: (...args: any[]) => void
    },
  ) {}

  /**
   * Get or create a Redis connection for the given URL.
   * Connections are lazy -- they connect on first command, not on creation.
   */
  get(url: string): Redis {
    const existing = this.pools.get(url)
    if (existing && existing.status !== 'end') {
      return existing
    }

    this.logger?.debug(`[RedisPool] Creating connection for: ${this.maskUrl(url)}`)

    const redis = new Redis(url, {
      maxRetriesPerRequest: null, // Required for BullMQ Workers
      enableReadyCheck: false,
      lazyConnect: true,
      // Connection naming for monitoring
      connectionName: `dispatch-pool-${this.pools.size}`,
    })

    redis.on('error', (err) => {
      this.logger?.error(`[RedisPool] Connection error for ${this.maskUrl(url)}:`, err)
    })

    redis.on('close', () => {
      this.logger?.debug(`[RedisPool] Connection closed for ${this.maskUrl(url)}`)
    })

    this.pools.set(url, redis)
    return redis
  }

  /**
   * Get the number of active connections.
   */
  get size(): number {
    return this.pools.size
  }

  /**
   * Close all connections and clear the pool.
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = []

    for (const [url, redis] of this.pools) {
      this.logger?.debug(`[RedisPool] Closing connection for ${this.maskUrl(url)}`)
      closePromises.push(
        redis.quit().catch((err) => {
          this.logger?.error(`[RedisPool] Error closing ${this.maskUrl(url)}:`, err)
        }).then(() => undefined),
      )
    }

    await Promise.all(closePromises)
    this.pools.clear()
  }

  /**
   * Mask URL for logging (hide password).
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url)
      if (parsed.password) {
        parsed.password = '***'
      }
      return parsed.toString()
    } catch {
      return url.replace(/:\/\/[^@]+@/, '://***@')
    }
  }
}
