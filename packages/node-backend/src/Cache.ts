import { type Milliseconds, Promises } from '@goatlab/js-utils'
import type { Options } from 'keyv'

const Keyv = require('keyv')

import { KeyvLru } from './cache/KeyvLrus'
import { LazyRedisStore } from './cache/LazyRedisStore'
import { RedisConnectionPool } from './cache/RedisConnectionPool'

export interface CacheOptions<T> extends Options<T> {
  usesLRUMemory?: boolean
  tenantId?: string
  /**
   * When true (default), Redis connection is deferred until first use.
   * This prevents connection exhaustion during Cloud Run/serverless deployments
   * where old and new containers may briefly run simultaneously.
   *
   * Set to false for eager connection (fail-fast behavior).
   *
   * @default true
   */
  lazy?: boolean
}

export class Cache<T extends object = any> extends Keyv<T> {
  private ns: string
  private _tenantId?: string
  private usesLRUMemory?: boolean
  private keyvLru: KeyvLru<T>
  private memoryCache: typeof Keyv
  private connectionString?: string
  private connectionPool: RedisConnectionPool
  private lazyStore?: LazyRedisStore

  constructor({
    connection,
    opts
  }: {
    connection: string | undefined
    opts?: CacheOptions<T>
  }) {
    const tenantId = opts?.tenantId
    const namespace = opts?.namespace || ''
    const lazy = opts?.lazy !== false // Default to true

    // Build the full namespace including tenant ID if provided
    // Format: "tenantId:namespace" or "tenantId" or "namespace" or ""
    const fullNamespace =
      tenantId && namespace
        ? `${tenantId}:${namespace}`
        : tenantId || namespace || ''

    // Get connection pool instance
    const pool = RedisConnectionPool.getInstance()

    // Determine which store to use
    let store: any
    let lazyStore: LazyRedisStore | undefined

    if (connection) {
      if (lazy) {
        // Lazy mode: use LazyRedisStore that defers connection
        lazyStore = new LazyRedisStore(connection)
        store = lazyStore
      } else {
        // Eager mode: connect immediately via pool
        store = pool.getConnection(connection)
      }
    } else {
      // No connection string: use in-memory LRU
      store = new KeyvLru<T>({
        max: 1000,
        resetTtl: false,
        ttl: 0
      })
    }

    super({
      store,
      ...opts,
      namespace: fullNamespace
    })

    // Manually set up iterator for LazyRedisStore as a fallback.
    // With opts.dialect='redis', Keyv should detect it automatically, but this ensures
    // deleteWhereStartsWith and getValueWhereKeyStartsWith work even if detection fails.
    if (lazyStore && typeof lazyStore.iterator === 'function') {
      this.iterator = lazyStore.iterator.bind(lazyStore)
    }

    this.connectionString = connection
    this.connectionPool = pool
    this.lazyStore = lazyStore

    this.keyvLru = new KeyvLru<T>({
      max: 1000,
      resetTtl: false,
      ttl: 0
    })

    this.memoryCache = new Keyv({
      store: this.keyvLru,
      namespace: fullNamespace
    })

    this.ns = fullNamespace
    this._tenantId = tenantId
    this.usesLRUMemory = opts?.usesLRUMemory || false
  }

  public get tenantId(): string | undefined {
    return this._tenantId
  }

  /**
   * Check if the cache is using lazy initialization
   */
  public isLazy(): boolean {
    return this.lazyStore !== undefined
  }

  /**
   * Check if the Redis connection is established (for lazy mode)
   */
  public isConnected(): boolean {
    if (this.lazyStore) {
      return this.lazyStore.isConnected()
    }
    // For eager mode or in-memory, always "connected"
    return true
  }

  private isValidResult(result: any): boolean {
    return (
      this.isNotNullish(result) &&
      this.isNotEmptyString(result) &&
      this.isNotEmptyArray(result) &&
      this.isNotEmptyObject(result)
    )
  }

  private isNotNullish(value: any): boolean {
    return value !== null && value !== undefined
  }

  private isNotEmptyString(value: any): boolean {
    return typeof value !== 'string' || value.trim() !== ''
  }

  private isNotEmptyArray(value: any): boolean {
    return !Array.isArray(value) || value.length !== 0
  }

  private isNotEmptyObject(value: any): boolean {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return true
    }
    const nonNullValues = Object.values(value).filter(
      objValue => objValue !== null
    )
    return nonNullValues.length !== 0
  }

  public async get(key: string | string[]): Promise<T> {
    // Search first in LRU memory
    // It will greatly improve performance
    // for "frequent" uses
    if (this.usesLRUMemory) {
      const memoryVal = await this.memoryCache.get(key)

      if (memoryVal) {
        return memoryVal
      }
    }

    const result = await super.get(key)

    if (this.usesLRUMemory && result) {
      // We could also just overwrite the set method as well
      await this.memoryCache.set(key, result)
    }

    return result
  }

  public async delete(key: string): Promise<boolean> {
    if (this.usesLRUMemory) {
      await this.memoryCache.delete(key)
    }
    return await super.delete(key)
  }

  public async has(key: string[]): Promise<boolean[]> // TODO: Revisar esto ya que tenia problemas y tuve que hacer sobrecarga
  public async has(key: string): Promise<boolean>
  public async has(key: string | string[]): Promise<boolean | boolean[]> {
    const value = await this.get(key)

    if (Array.isArray(value)) {
      return value.map(v => this.isValidResult(v))
    }

    return !!value
  }

  /**
   * Get an item from the cache, or execute the given Closure and store the result.
   *
   * @param  string $key
   * @param  int  $ms - time in milliseconds
   * @param  $callback
   */
  public async remember(
    key: string,
    ms: Milliseconds,
    fx: () => Promise<T>
  ): Promise<T> {
    const value = await this.get(key)

    if (value) {
      return value
    }

    const result = await fx()

    if (this.isValidResult(result)) {
      await this.set(key, result, ms)
    }

    return result
  }

  /**
   * Get an item from the cache, or execute the given Closure and store the result forever.
   *
   * @param  string  $key
   * @param  \Closure  $callback
   */
  public async rememberForever(key: string, fx: () => Promise<T>): Promise<T> {
    const value = await this.get(key)

    if (value) {
      return value
    }

    const result = await fx()

    if (this.isValidResult(result)) {
      await this.set(key, result)
    }

    return result
  }

  /**
   * Retrieve an item from the cache and delete it.
   *
   * @param  string  $key
   */
  public async pull(key: string): Promise<T> {
    const value = await this.get(key)

    if (value) {
      await this.delete(key)
    }

    return value as T
  }

  /**
   * Remove an item from the cache.
   *
   * @param  string  $key
   * @return bool
   */
  public async forget(key: string): Promise<boolean> {
    return await this.delete(key)
  }

  /**
   * Remove all items from the cache in the current namespace.
   *
   * Note: We use iterator-based deletion instead of KeyvRedis's clear() because
   * clear() relies on Redis Sets to track keys. Keys created before proper namespace
   * setup or with useRedisSets:false won't be in those sets and won't be deleted.
   * The iterator uses Redis SCAN which finds ALL keys matching the namespace pattern.
   *
   * @return void
   */
  public async flush(): Promise<void> {
    // For in-memory stores without iterator, use clear() directly
    if (!this.iterator) {
      await this.clear()
      return
    }

    // Try to get direct Redis access for batch deletion (much faster)
    const redis = await this.getRedisClient()
    if (redis) {
      // Use Redis SCAN + UNLINK for fast bulk deletion
      const pattern = this.ns ? `${this.ns}:*` : '*'
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        // UNLINK is non-blocking and faster than DEL for large keysets
        await redis.unlink(keys)
      }
    } else {
      // Fallback: iterator-based deletion (slower but works for any store)
      const namespacePrefix = this.ns ? `${this.ns}:` : ''
      const keysToDelete: string[] = []

      for await (const [key] of this.iterator(this.ns)) {
        let keyWithoutNamespace = key
        if (namespacePrefix && key.startsWith(namespacePrefix)) {
          keyWithoutNamespace = key.substring(namespacePrefix.length)
        }
        keysToDelete.push(keyWithoutNamespace)
      }

      // Delete in parallel batches for better performance
      const BATCH_SIZE = 100
      for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
        const batch = keysToDelete.slice(i, i + BATCH_SIZE)
        await Promise.all(batch.map(key => this.delete(key)))
      }
    }

    // Also clear memory cache if using LRU memory
    if (this.usesLRUMemory) {
      await this.memoryCache.clear()
    }
  }

  /**
   * Get the underlying Redis client if available.
   * Ensures lazy connection is established first.
   * Returns undefined for non-Redis stores.
   */
  private async getRedisClient(): Promise<any> {
    try {
      if (this.lazyStore) {
        // Ensure connection is established first and get the store
        const store = await this.lazyStore.getStore()
        return (store as any)?.redis
      }
      // For eager mode, check if store has redis property
      const store = this.opts?.store as any
      return store?.redis
    } catch {
      return undefined
    }
  }

  public async deleteWhereStartsWith(value: string): Promise<void> {
    if (!this.iterator) {
      await Promises.map(Object.keys(this.opts.store.cache.items), async k => {
        if (k.startsWith(`${this.ns}:${value}`)) {
          await this.delete(k.replace(`${this.ns}:`, ''))
        }
      })
      return
    }

    // The Redis iterator returns keys with full namespace prefix (e.g., "namespace:foo:1")
    // We need to strip the namespace to get the actual key
    const namespacePrefix = this.ns ? `${this.ns}:` : ''

    for await (const [key] of this.iterator(this.ns)) {
      // Strip namespace prefix from key
      let keyToCheck = key
      if (namespacePrefix && key.startsWith(namespacePrefix)) {
        keyToCheck = key.substring(namespacePrefix.length)
      }

      if (keyToCheck.startsWith(value)) {
        // Delete using the key without namespace (Keyv handles namespace internally)
        await this.delete(keyToCheck)
      }
    }
  }

  public async getValueWhereKeyStartsWith<T>(value: string): Promise<T[]> {
    const result: T[] = []
    if (!this.iterator) {
      await Promises.map(Object.keys(this.opts.store.cache.items), async k => {
        if (k.startsWith(`${this.ns}:${value}`)) {
          const val = JSON.parse(this.opts.store.cache.items[k].value).value
          result.push(val)
        }
      })
      return result
    }

    // The Redis iterator returns keys with full namespace prefix (e.g., "namespace:foo:1")
    // and values as JSON strings (e.g., '{"value":"a","expires":null}')
    // We need to strip the namespace and parse the values
    const namespacePrefix = this.ns ? `${this.ns}:` : ''

    for await (const [key, val] of this.iterator(this.ns)) {
      // Strip namespace prefix from key
      let keyToCheck = key
      if (namespacePrefix && key.startsWith(namespacePrefix)) {
        keyToCheck = key.substring(namespacePrefix.length)
      }

      if (keyToCheck.startsWith(value)) {
        // Parse JSON value if it's a string (Redis returns raw JSON)
        let parsedValue = val
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val)
            parsedValue = parsed.value !== undefined ? parsed.value : parsed
          } catch {
            // If parsing fails, use the raw value
            parsedValue = val
          }
        }
        result.push(parsedValue)
      }
    }

    return result
  }

  /**
   * Dispose of this cache instance and release the Redis connection.
   * After calling this, the cache instance should not be used.
   * The connection will remain in the pool for reuse by other instances.
   */
  public dispose(): void {
    if (this.connectionString) {
      this.connectionPool.releaseConnection(this.connectionString)
    }
  }

  /**
   * Disconnect the Redis connection for this cache instance.
   * This removes the connection from the pool entirely.
   * Use this when you're certain no other instances need this connection.
   */
  public async disconnect(): Promise<void> {
    if (this.lazyStore) {
      await this.lazyStore.disconnect()
    } else if (this.connectionString) {
      await this.connectionPool.disconnect(this.connectionString)
    }
  }
}
