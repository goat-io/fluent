import { Promises, type Milliseconds } from '@goatlab/js-utils'
import { Options } from 'keyv'
import KeyvRedis from '@keyv/redis'
const Keyv = require('keyv')
import { KeyvLru } from 'keyv-lru'

export class Cache extends Keyv {
  private _ns: string
  private usesLRUMemory?: boolean
  private keyvLru: KeyvLru
  private memoryCache: typeof Keyv

  constructor({
    connection,
    opts
  }: {
    connection: string | undefined
    opts?: Options<any> & { usesLRUMemory?: boolean }
  }) {
    super({
      store: connection
        ? new KeyvRedis(connection)
        : new KeyvLru({
            max: 1000,
            notify: false,
            ttl: 0,
            expire: 0
          }),
      ...opts
    })

    this.keyvLru = new KeyvLru({
      max: 1000,
      notify: false,
      ttl: 0,
      expire: 0
    })

    this.memoryCache = new Keyv({
      store: this.keyvLru,
      namespace: opts?.namespace || ''
    })

    this._ns = opts?.namespace || ''
    this.usesLRUMemory = opts?.usesLRUMemory || false
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

  public async get<T>(key: string | string[]): Promise<T> {
    // Search first in LRU memory
    // It will greatly improve performance
    // for "frequent" users
    if (this.usesLRUMemory) {
      const memoryVal = await this.memoryCache.get(`${this._ns}:${key}`)

      if (memoryVal) {
        return memoryVal as T
      }
    }

    const result = await super.get(key as any)

    if (this.usesLRUMemory && result) {
      // We could also just overwrite the set method as well
      await this.memoryCache.set(`${this._ns}:${key}`, result)
    }

    return result as T
  }

  public async delete(key: string): Promise<boolean> {
    if (this.usesLRUMemory) {
      await this.memoryCache.delete(`${this._ns}:${key}`)
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
  public async remember<T>(
    key: string,
    ms: Milliseconds,
    fx: () => Promise<T>
  ): Promise<T> {
    const value = await this.get<T>(key)

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
  public async rememberForever<T>(
    key: string,
    fx: () => Promise<T>
  ): Promise<T> {
    const value = await this.get<T>(key)

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
  public async pull(key: string): Promise<any> {
    const value = await this.get(key)

    if (value) {
      await this.delete(key)
    }

    return value
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
      await Promises.map(
        Object.keys(this.opts.store['cache']['cache']),
        async k => {
          if (k.startsWith(`${this._ns}:${value}`)) {
            await this.delete(k.replace(`${this._ns}:`, ''))
          }
        }
      )
      return
    }

    for await (const [key] of this.iterator(this._ns)) {
      if (key.startsWith(value)) {
        await this.delete(key)
      }
    }
  }

  public async getValueWhereKeyStartsWith<T>(value: string): Promise<T[]> {
    const result = []
    if (!this.iterator) {
      await Promises.map(
        Object.keys(this.opts.store['cache']['cache']),
        async k => {
          if (k.startsWith(`${this._ns}:${value}`)) {
            const val = JSON.parse(
              this.opts.store['cache']['cache'][k].value
            ).value
            result.push(val)
          }
        }
      )
      return result
    }

    for await (const [key, val] of this.iterator(this._ns)) {
      if (key.startsWith(value)) {
        result.push(val)
      }
    }

    return result
  }
}
