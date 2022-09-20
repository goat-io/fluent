import type { Falsy, Nullish, Primitive, Truthy } from './types'
import type { AnyObject } from './types'

export class IsClass {
  /**
   * Object is considered empty if it's one of:
   * undefined
   * null
   * '' (empty string)
   * [] (empty array)
   * {} (empty object)
   * new Map() (empty Map)
   * new Set() (empty Set)
   */
  empty(obj: any): boolean {
    if (obj === undefined || obj === null) return true

    if (typeof obj === 'string' || Array.isArray(obj)) {
      return obj.length === 0
    }

    if (obj instanceof Map || obj instanceof Set) {
      return obj.size === 0
    }

    if (typeof obj === 'object') {
      return Object.keys(obj).length === 0
    }

    return false
  }

  emptyObject(obj: any): boolean {
    return obj && obj.constructor === Object && Object.keys(obj).length === 0
  }

  primitive(v: any): v is Primitive {
    return (
      v === null ||
      v === undefined ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'string' ||
      typeof v === 'bigint' ||
      typeof v === 'symbol'
    )
  }

  /**
   * Returns true if item is Object, not null and not Array.
   */
  object(item: any): item is AnyObject {
    return (
      (typeof item === 'object' && item !== null && !Array.isArray(item)) ||
      false
    )
  }

  /**
   * Same as Boolean, but with correct type output.
   * Related:
   * https://github.com/microsoft/TypeScript/issues/16655
   * https://www.karltarvas.com/2021/03/11/typescript-array-filter-boolean.html
   *
   * @example
   *
   * [1, 2, undefined].filter(_isTruthy)
   * // => [1, 2]
   */
  truthy = <T>(v: T): v is Truthy<T> => !!v
  falsy = <T>(v: T): v is Falsy<T> => !v

  null = <T>(v: T): v is T extends null ? T : never => v === null
  undefined = <T>(v: T): v is T extends undefined ? T : never =>
    typeof v === 'undefined'
  nullish = <T>(v: T): v is Nullish<T> => typeof v === 'undefined' || v === null
  notNullish = <T>(v: T): v is NonNullable<T> => v !== undefined && v !== null
}
export const Is = new IsClass()
