import { Is } from '../Is'
import { Promisable } from '../types'

export type MemoSerializer = (args: any[]) => any

export const jsonMemoSerializer: MemoSerializer = args => {
  if (args.length === 0) {
    return undefined
  }
  if (args.length === 1 && Is.primitive(args[0])) {
    return args[0]
  }
  return JSON.stringify(args)
}

export interface MemoCache<Key = any, Value = any> {
  has(k: Key): boolean
  get(k: Key): Value | Error | undefined
  set(k: Key, v: Value | Error): void

  /**
   * Clear is only called when `.dropCache()` is called.
   * Otherwise the Cache is "persistent" (never cleared).
   */
  clear(): void
}

export interface AsyncMemoCache<Key = any, Value = any> {
  // `has` method is removed, because it is assumed that it has a cost and it's best to avoid doing both `has` and then `get`
  // has(k: any): Promise<boolean>
  /**
   * `undefined` value returned indicates the ABSENCE of value in the Cache.
   * This also means that you CANNOT store `undefined` value in the Cache, as it'll be treated as a MISS.
   * You CAN store `null` value instead, it will be treated as a HIT.
   */
  get(k: Key): Promisable<Value | Error | undefined>
  set(k: Key, v: Value | Error): Promisable<void>

  /**
   * Clear is only called when `.dropCache()` is called.
   * Otherwise the Cache is "persistent" (never cleared).
   */
  clear(): Promisable<void>
}

export class MapMemoCache<Key = any, Value = any>
  implements MemoCache<Key, Value>, AsyncMemoCache<Key, Value>
{
  private m = new Map<Key, Value | Error>()

  has(k: Key): boolean {
    return this.m.has(k)
  }

  get(k: Key): Value | Error | undefined {
    return this.m.get(k)
  }

  set(k: Key, v: Value | Error): void {
    this.m.set(k, v)
  }

  clear(): void {
    this.m.clear()
  }
}
