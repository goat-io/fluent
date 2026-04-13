import { LRU } from 'tiny-lru'
import type { ExpirableItem, MapInterface } from './lrutypes'

export type KeyvLruOptions = {
  max: number
  ttl?: number
  resetTtl?: boolean
  serialize?: (data: any) => string
  deserialize?: (data: string) => any
}

/**
 * An adapter from tiny-lru to the MapInterface API.
 */
export class KeyvLru<T> implements MapInterface {
  cache: LRU<T>
  private defaultTtl?: number
  serialize?: (data: any) => string
  deserialize?: (data: string) => any
  opts?: {
    serialize?: (data: any) => string
    deserialize?: (data: string) => any
  }

  constructor(options: KeyvLruOptions = { max: 500 }) {
    this.defaultTtl = options.ttl
    this.cache = new LRU(options.max, this.defaultTtl, options.resetTtl)

    this.serialize = options.serialize
    this.deserialize = options.deserialize

    // Expose opts to match test expectations
    this.opts = {
      deserialize: options.deserialize,
      serialize: options.serialize,
    }
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    if (!this.cache.has(key)) {
      return false
    }
    this.cache.delete(key)
    return true
  }

  get(key: string): ExpirableItem<T> | undefined {
    return this.cache.get(key) as ExpirableItem<T> | undefined
  }

  set(key: string, value: T): 1 | 0 {
    if (typeof value === 'symbol') {
      const e = new Error()
      e.message = 'symbol cannot be serialized'
      throw e
    }

    this.cache.set(key, value)
    return 1
  }
}
