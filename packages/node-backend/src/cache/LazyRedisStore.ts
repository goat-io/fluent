import KeyvRedis from '@keyv/redis'
import type { ClusterNode, ClusterOptions } from 'ioredis'
import { RedisConnectionPool } from './RedisConnectionPool'

export interface ClusterConfig {
  nodes: ClusterNode[]
  options?: ClusterOptions
}

/**
 * A lazy-loading Redis store for Keyv.
 * Defers Redis connection until the first operation is performed.
 * This prevents connection exhaustion during Cloud Run/serverless deployments
 * where old and new containers may briefly run simultaneously.
 *
 * Supports both standalone Redis (via connection string) and Redis Cluster (via clusterConfig).
 *
 * @example
 * ```typescript
 * // Standalone
 * const store = new LazyRedisStore('redis://localhost:6379')
 *
 * // Cluster
 * const store = new LazyRedisStore('cluster', {
 *   nodes: [{ host: '10.0.0.2', port: 6379 }],
 *   options: { redisOptions: { password: 'secret', tls: { rejectUnauthorized: false } } }
 * })
 * ```
 */
export class LazyRedisStore {
  private connectionString: string
  private pool: RedisConnectionPool
  private _store: KeyvRedis | undefined
  private _connecting: Promise<KeyvRedis> | undefined
  private _namespace: string | undefined
  private _clusterConfig?: ClusterConfig

  /**
   * Opts property for Keyv compatibility.
   * Keyv checks for store.opts to detect if iteration is supported.
   * It looks for opts.dialect or opts.url containing 'redis', 'postgres', etc.
   * @see https://github.com/jaredwray/keyv/blob/main/packages/keyv/src/index.ts
   */
  public readonly opts: { dialect: string; url: string }

  constructor(connectionString: string, clusterConfig?: ClusterConfig) {
    this.connectionString = connectionString
    this._clusterConfig = clusterConfig
    this.pool = RedisConnectionPool.getInstance()

    // Set opts for Keyv iterator detection
    // Keyv's _checkIterableAdapter() checks if opts.dialect is in iterableAdapters
    // or if opts.url contains one of the adapter names
    this.opts = {
      dialect: 'redis',
      url: connectionString,
    }

    // Bind the iterator to this instance for Keyv compatibility
    this.iterator = this.iterator.bind(this)
  }

  /**
   * Namespace property for Keyv compatibility.
   * Keyv sets this after construction to enable namespace-scoped operations.
   * We forward it to the underlying KeyvRedis store when connected.
   */
  get namespace(): string | undefined {
    return this._namespace
  }

  set namespace(value: string | undefined) {
    this._namespace = value
    // Forward to underlying store if already connected
    if (this._store) {
      this._store.namespace = value
    }
  }

  /**
   * Get the underlying KeyvRedis store, creating connection if needed.
   * Uses a promise to ensure only one connection attempt happens even
   * if multiple operations are called simultaneously.
   */
  public async getStore(): Promise<KeyvRedis> {
    if (this._store) {
      return this._store
    }

    // If already connecting, wait for that to complete
    if (this._connecting) {
      return this._connecting
    }

    // Start connection
    this._connecting = new Promise((resolve, reject) => {
      try {
        this._store = this._clusterConfig
          ? this.pool.getClusterConnection(
              this._clusterConfig.nodes,
              this._clusterConfig.options,
            )
          : this.pool.getConnection(this.connectionString)

        // Forward namespace to the underlying store if set
        // This is critical for clear() and other namespace-scoped operations
        if (this._namespace !== undefined) {
          this._store.namespace = this._namespace
        }

        resolve(this._store)
      } catch (error) {
        this._connecting = undefined
        reject(error)
      }
    })

    return this._connecting
  }

  // Keyv store interface methods - all lazily connect

  async get(key: string): Promise<any> {
    const store = await this.getStore()
    return store.get(key)
  }

  async getMany(keys: string[]): Promise<any[]> {
    const store = await this.getStore()
    if (typeof store.getMany === 'function') {
      return store.getMany(keys)
    }
    // Fallback if getMany not supported
    return Promise.all(keys.map(k => store.get(k)))
  }

  async set(key: string, value: any, ttl?: number): Promise<any> {
    const store = await this.getStore()
    return store.set(key, value, ttl)
  }

  async delete(key: string): Promise<boolean> {
    const store = await this.getStore()
    return store.delete(key)
  }

  async deleteMany(keys: string[]): Promise<boolean> {
    const store = await this.getStore()
    if (typeof store.deleteMany === 'function') {
      return store.deleteMany(keys)
    }
    // Fallback
    await Promise.all(keys.map(k => store.delete(k)))
    return true
  }

  async clear(): Promise<void> {
    const store = await this.getStore()
    return store.clear()
  }

  async has(key: string): Promise<boolean> {
    const store = await this.getStore()
    if (typeof store.has === 'function') {
      return store.has(key)
    }
    // Fallback
    const value = await store.get(key)
    return value !== undefined
  }

  /**
   * Iterator for Keyv - returns an async iterable iterator.
   * This method is defined to tell Keyv that iteration is supported.
   */
  async *iterator(namespace?: string): AsyncGenerator<[string, any]> {
    const store = await this.getStore()
    if (store.iterator) {
      yield* store.iterator(namespace) as AsyncGenerator<[string, any]>
    }
  }

  /**
   * Check if the store is connected
   */
  isConnected(): boolean {
    return this._store !== undefined
  }

  /**
   * Get the connection string (for pool management)
   */
  getConnectionString(): string {
    return this.connectionString
  }

  /**
   * Disconnect the underlying store
   */
  async disconnect(): Promise<void> {
    if (this._store) {
      await this.pool.disconnect(this.connectionString)
      this._store = undefined
      this._connecting = undefined
    }
  }
}
