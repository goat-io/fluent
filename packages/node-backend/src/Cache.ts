import { type Milliseconds, Promises } from '@goatlab/js-utils'
import type { Options } from 'keyv'

const Keyv = require('keyv')

import { KeyvLru } from './cache/KeyvLrus'
import { RedisConnectionPool } from './cache/RedisConnectionPool'

export class Cache<T extends object = any> extends Keyv<T> {
  private ns: string
  private _tenantId?: string
  private usesLRUMemory?: boolean
  private keyvLru: KeyvLru<T>
  private memoryCache: typeof Keyv
  private connectionString?: string
  private connectionPool: RedisConnectionPool

  constructor({
    connection,
    opts
  }: {
    connection: string | undefined
    opts?: Options<T> & { usesLRUMemory?: boolean; tenantId?: string }
  }) {
    const tenantId = opts?.tenantId
    const namespace = opts?.namespace || ''

    // Build the full namespace including tenant ID if provided
    // Format: "tenantId:namespace" or "tenantId" or "namespace" or ""
    const fullNamespace =
      tenantId && namespace
        ? `${tenantId}:${namespace}`
        : tenantId || namespace || ''

    // Get connection pool instance
    const pool = RedisConnectionPool.getInstance()

    super({
      store: connection
        ? pool.getConnection(connection)
        : new KeyvLru<T>({
            max: 1000,
            resetTtl: false,
            ttl: 0
          }),
      ...opts,
      namespace: fullNamespace
    })

    this.connectionString = connection
    this.connectionPool = pool

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
   * Remove all items from the cache in the current namespace
   *
   * @return bool
   */
  public async flush(): Promise<void> {
    await this.clear()
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

    // When using iterator with compound namespaces (e.g., tenant:namespace),
    // keyv may not strip the full namespace correctly. We need to handle this.
    const namespaceParts = this.ns.split(':')
    const hasCompoundNamespace = namespaceParts.length > 1

    for await (const [key] of this.iterator(this.ns)) {
      let keyToCheck = key

      // If we have a compound namespace and the key still contains part of it,
      // we need to strip the remaining namespace parts
      if (hasCompoundNamespace && key.includes(':')) {
        // Check if the key starts with any remaining namespace parts
        for (let i = 1; i < namespaceParts.length; i++) {
          const remainingNamespace = namespaceParts.slice(i).join(':')
          if (key.startsWith(`${remainingNamespace}:`)) {
            keyToCheck = key.substring(remainingNamespace.length + 1)
            break
          }
        }
      }

      if (keyToCheck.startsWith(value)) {
        // Use the processed key (without namespace parts) for deletion
        await this.delete(keyToCheck)
      }
    }
  }

  public async getValueWhereKeyStartsWith<T>(value: string): Promise<T[]> {
    const result = []
    if (!this.iterator) {
      await Promises.map(Object.keys(this.opts.store.cache.items), async k => {
        if (k.startsWith(`${this.ns}:${value}`)) {
          const val = JSON.parse(this.opts.store.cache.items[k].value).value
          result.push(val)
        }
      })
      return result
    }

    // When using iterator with compound namespaces (e.g., tenant:namespace),
    // keyv may not strip the full namespace correctly. We need to handle this.
    const namespaceParts = this.ns.split(':')
    const hasCompoundNamespace = namespaceParts.length > 1

    for await (const [key, val] of this.iterator(this.ns)) {
      let keyToCheck = key

      // If we have a compound namespace and the key still contains part of it,
      // we need to strip the remaining namespace parts
      if (hasCompoundNamespace && key.includes(':')) {
        // Check if the key starts with any remaining namespace parts
        for (let i = 1; i < namespaceParts.length; i++) {
          const remainingNamespace = namespaceParts.slice(i).join(':')
          if (key.startsWith(`${remainingNamespace}:`)) {
            keyToCheck = key.substring(remainingNamespace.length + 1)
            break
          }
        }
      }

      if (keyToCheck.startsWith(value)) {
        result.push(val)
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
    if (this.connectionString) {
      await this.connectionPool.disconnect(this.connectionString)
    }
  }
}
