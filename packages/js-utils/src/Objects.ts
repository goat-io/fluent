import {
  AnyObject,
  ObjectMapper,
  ObjectPredicate,
  StringMap,
  ValueOf
} from './types'

declare global {
  function hasOwnProperty(key: string | number | symbol): boolean
}

type KeyFactory = (previousKey: string, currentKey: string) => string

const isArray = Array.isArray
type Primitive = string | number | boolean | null | undefined | symbol | bigint
type DeepComparable =
  | Primitive
  | Date
  | RegExp
  | readonly unknown[]
  | Record<string, unknown>

// Module-local helper interfaces
interface ObjectWithKeys {
  readonly [key: string]: unknown
}

const getObjectKeys = (obj: ObjectWithKeys): readonly string[] => {
  // Cache-friendly key extraction with immutable return type
  return Object.keys(obj)
}

const hasOwnProperty = Object.prototype.hasOwnProperty

interface ObjectIdLike {
  readonly _bsontype: 'ObjectId'
}

// Module-local type guards for performance optimization
const isObjectIdLike = (value: unknown): value is ObjectIdLike =>
  typeof value === 'object' &&
  value !== null &&
  '_bsontype' in value &&
  (value as any)._bsontype === 'ObjectId'

const isDateInstance = (value: unknown): value is Date => value instanceof Date

// Optimized empty check with early returns
const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

class ObjectsClass {
  /**
   * Safely executes a function and returns its result or a default value
   * @param fn Function to execute
   * @param defaultValue Value to return if function throws or returns undefined
   */
  get = <T = any>(fn: () => T, defaultValue?: T): T => {
    try {
      const value = fn()
      return value === undefined ? (defaultValue as T) : value
    } catch {
      return defaultValue as T
    }
  }

  /**
   * Given an object and the string version of the path it
   * will return the value if it exists or the default.
   * Simplified version of lodash get
   * @param {*} obj
   * @param {*} path
   * @param {*} def
   */
  getFromPath = (obj: any, path: string, def?: any) => {
    let PATH = path
    let assignedName: string | undefined
    if (path.includes(' as ')) {
      const pathArray = path.split(' as ')
      PATH = pathArray[0]
      assignedName = pathArray[1]?.trim()
    }

    const fullPath = PATH.replace(/\[/g, '.')
      .replace(/]/g, '')
      .split('.')
      .filter(Boolean)
      .map(e => e.trim())

    let current = obj
    for (const step of fullPath) {
      if (current == null || !(step in current)) {
        return { label: assignedName || PATH, value: def }
      }
      current = current[step]
    }

    return { label: assignedName || PATH, value: current }
  }

  /**
   * Given a nested Object it generates a flattened version using
   * dot notation. Custom notation can be assigned using the
   * keyFactory helper function
   * @param ob
   * @param includeBaseKeys
   * @param keyFactory
   */
  flatten = (
    ob: AnyObject,
    includeBaseKeys: boolean = false,
    keyFactory: KeyFactory = (previousKey, currentKey) =>
      `${previousKey}.${currentKey}`
  ): Record<string, string> => {
    const toReturn: Record<string, string> = {}

    const walk = (obj: AnyObject, path: string) => {
      for (const key in obj) {
        if (!hasOwnProperty.call(obj, key)) continue

        const value = obj[key]
        const newKey = path ? keyFactory(path, key) : key

        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          if (includeBaseKeys && !(newKey in toReturn)) {
            toReturn[newKey] = 'true'
          }
          walk(value, newKey)
        } else {
          toReturn[newKey] = String(value)
        }
      }
    }

    walk(ob, '')

    return toReturn
  }

  /**
   * Checks if a value is a plain object (created by Object constructor or object literal)
   * @param obj - The value to check
   * @returns True if the value is a plain object, false otherwise
   */
  isPlainObject = (obj: unknown): obj is AnyObject =>
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    (obj.constructor === Object || obj.constructor === undefined)

  /**
   * Converts a flattened object with dot notation keys back to a nested object structure
   * @param obj - The flattened object to convert
   * @param markNewObject - Whether to mark newly created objects with isObject: true
   */
  getNestedObject = (obj: AnyObject, markNewObject: boolean): AnyObject =>
    Object.entries(obj).reduce((result, [prop, val]) => {
      prop
        .split('.')
        .reduce((nestedResult, currentProp, propIndex, propArray) => {
          const isLastProp = propIndex === propArray.length - 1
          if (isLastProp) {
            nestedResult[currentProp] = this.isPlainObject(val)
              ? this.getNestedObject(val as AnyObject, markNewObject)
              : val
          } else {
            nestedResult[currentProp] =
              nestedResult[currentProp] ||
              (markNewObject ? { isObject: true } : {})
          }
          return nestedResult[currentProp] as AnyObject
        }, result)
      return result
    }, {} as AnyObject)

  /**
   * Opposite of the flatten method. Given a nested dot notation flatten object.
   * it will generate the corresponding nested object
   * @param obj
   */
  nest = (obj: AnyObject, markNewObject = false): AnyObject => {
    if (!obj) {
      return {}
    }
    return this.getNestedObject(obj, markNewObject)
  }

  /**
   * Deep clones a JS object using JSON.parse. This method
   * will not clone functions inside objects
   * @param {Object} object
   */
  clone = <T extends AnyObject>(object: T): T =>
    JSON.parse(JSON.stringify(object))

  /**
   * Given a value, it will check if it contains
   * none null, none undefined values inside
   * @param {string, Array, Object} value
   */
  isEmpty = (value: any): boolean => {
    if (value === null || value === undefined) {
      return true
    }

    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length === 0
    }

    if (value instanceof Map || value instanceof Set) {
      return value.size === 0
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0
    }

    return false
  }

  /**
   * Recursively removes all NULL values
   * from an Object or an Array
   *
   * @static
   * @param {Array|Object} object Array, Object to clean
   * @returns {Array|Object} returns the cleaned value
   */
  deleteNulls = (object: AnyObject) => {
    const obj = object
    const isArray = obj instanceof Array

    for (const k in obj) {
      if (obj[k] === null) {
        isArray ? obj.splice(Number(k), 1) : delete obj[k]
      } else if (typeof obj[k] === 'object') {
        this.deleteNulls(obj[k] as AnyObject)
      }
    }
    return obj
  }

  filterUndefinedValues<T extends AnyObject>(obj: T, mutate = false): T {
    return this.filterObject(obj, (_k, v) => v !== undefined, mutate)
  }

  filterObject<T extends AnyObject>(
    obj: T,
    predicate: ObjectPredicate<T>,
    mutate = false
  ): T {
    return Object.keys(obj).reduce(
      (r, k) => {
        if (!predicate(k as keyof T, r[k], obj)) delete r[k]
        return r
      },
      mutate ? obj : { ...obj }
    )
  }

  /**
   * Deeply removes all empty and nullish values from a
   * given object. Preserves Date and MongoDB ObjectId instances.
   *
   * Performance optimizations:
   * - Uses Object.hasOwnProperty.call for faster property checks
   * - Caches Object.keys calls to reduce overhead
   * - Early returns for common cases
   * - Type guards eliminate redundant checks
   *
   * @param object - The object to clean (mutated in place)
   * @returns The cleaned object
   */
  clearEmpties<T extends AnyObject>(object: T): T {
    // Use cached hasOwnProperty for better performance
    const hasOwnProp = Object.prototype.hasOwnProperty

    for (const key in object) {
      // Faster property check using cached reference
      if (!hasOwnProp.call(object, key)) continue

      const value = object[key]

      // Early return for simple empty values - most common case
      if (isEmptyValue(value)) {
        delete object[key]
        continue
      }

      // Handle objects (including arrays, but arrays are handled above)
      if (value && typeof value === 'object') {
        // Preserve Date and ObjectId instances - early type guard checks
        if (isDateInstance(value) || isObjectIdLike(value)) {
          continue // Keep these special object types
        }

        // Arrays are already handled by isEmptyValue, so this is plain objects
        if (!Array.isArray(value)) {
          // Recursively clean nested objects
          this.clearEmpties(value as AnyObject)

          // Remove if object became empty after cleaning
          // Cache keys call to avoid repeated computation
          const objectKeys = Object.keys(value)
          if (objectKeys.length === 0) {
            delete object[key]
          }
        }
      }
    }

    return object
  }

  isAnyObject = (val: any): boolean => {
    return typeof val === 'object' && !Array.isArray(val) && val !== null
  }

  /**
   * var users = {
   *  'fred':    { 'user': 'fred',    'age': 40 },
   *  'pebbles': { 'user': 'pebbles', 'age': 1 }
   * }
   *
   * _.mapValues(users, function(o) { return o.age; });
   * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
   *
   * // The `_.property` iteratee shorthand.
   * _.mapValues(users, 'age')
   * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
   */
  mapValues<T extends AnyObject, OUT = T>(
    obj: T,
    mapper: ObjectMapper<T, any>,
    mutate = false
  ): OUT {
    return Object.entries(obj).reduce((map, [k, v]) => {
      map[k as keyof OUT] = mapper(k, v, obj)
      return map
    }, (mutate ? obj : {}) as OUT)
  }

  mapKeys<T extends AnyObject>(
    obj: T,
    mapper: ObjectMapper<T, string>
  ): StringMap<T[keyof T]> {
    // eslint-disable-next-line unicorn/prefer-object-from-entries
    return Object.entries(obj).reduce((map, [k, v]) => {
      map[mapper(k, v, obj) as keyof T] = v
      return map
    }, {} as T)
  }

  /**
   * Maps object through predicate - a function that receives (k, v, obj)
   * k - key
   * v - value
   * obj - whole object
   *
   * Order of arguments in the predicate is different form mapValues / mapKeys!
   *
   * Predicate should return a _tuple_ [0, 1], where:
   * 0 - key of returned object (string)
   * 1 - value of returned object (any)
   *
   * If predicate returns falsy value (e.g undefined), or a tuple where key (first item) is falsy - then such key/value pair is ignored (filtered out).
   *
   * Non-string keys are passed via String(...)
   */
  mapObject<IN extends AnyObject, OUT>(
    obj: IN,
    mapper: ObjectMapper<IN, [key: string, value: any]>
  ): { [P in keyof IN]: OUT } {
    return Object.entries(obj).reduce((map, [k, v]) => {
      const r = mapper(k, v, obj) || []
      if (r[0]) {
        ;(map[r[0]] as any) = r[1]
      }
      return map
    }, {} as { [P in keyof IN]: OUT })
  }

  findKeyByValue<T extends AnyObject>(
    obj: T,
    value: ValueOf<T>
  ): keyof T | undefined {
    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        obj[key] === value
      ) {
        return key as keyof T
      }
    }
    return undefined
  }

  objectNullValuesToUndefined<T extends AnyObject>(obj: T, mutate = false): T {
    return this.mapValues(obj, (_k, v) => (v === null ? undefined : v), mutate)
  }

  isObject(item: any): item is AnyObject {
    return (
      (typeof item === 'object' && item !== null && !Array.isArray(item)) ||
      false
    )
  }

  isEmptyObject(obj: any): boolean {
    return obj && obj.constructor === Object && Object.keys(obj).length === 0
  }

  /**
   * Returns `undefined` if it's empty (according to `isEmpty()` specification),
   * otherwise returns the original object.
   */
  undefinedIfEmpty<T>(obj: T | undefined): T | undefined {
    return this.isEmpty(obj) ? undefined : obj
  }

  /**
   * Filters the object by removing all key-value pairs where Value is Empty (according to _isEmpty() specification).
   */
  filterEmptyValues<T extends AnyObject>(obj: T, mutate = false): T {
    return this.filterObject(obj, (_k, v) => !this.isEmpty(v), mutate)
  }

  sort<T extends AnyObject>(obj: T, keyOrder: (keyof T)[]): T {
    const r = {} as T

    keyOrder.forEach(key => {
      if (key in obj) {
        r[key] = obj[key]
      }
    })

    Object.entries(this.omit(obj, keyOrder)).forEach(([k, v]) => {
      r[k as keyof T] = v
    })

    return r
  }

  /**
   * Returns clone of `obj` with `props` omitted.
   * Opposite of Pick.
   */
  omit<T extends AnyObject, K extends keyof T>(
    obj: T,
    props: readonly K[],
    mutate = false
  ): T {
    return props.reduce(
      (r, prop) => {
        delete r[prop]
        return r
      },
      mutate ? obj : { ...obj }
    )
  }

  /**
   * Returns clone of `obj` with only `props` preserved.
   * Opposite of Omit.
   */
  pick<T extends AnyObject, K extends keyof T>(
    obj: T,
    props: readonly K[],
    mutate = false
  ): T {
    if (mutate) {
      // Start as original object (mutable), DELETE properties that are not whitelisted
      return Object.keys(obj).reduce((r, prop) => {
        if (!props.includes(prop as K)) delete r[prop]
        return r
      }, obj)
    } else {
      // Start as empty object, pick/add needed properties
      return props.reduce((r, prop) => {
        if (prop in obj) r[prop] = obj[prop]
        return r
      }, {} as T)
    }
  }

  sortObjectDeep<T>(o: T): T {
    // array
    if (Array.isArray(o)) {
      // eslint-disable-next-line unicorn/no-array-callback-reference
      return o.map(this.sortObjectDeep) as any
    }

    if (this.isObject(o)) {
      const out = {} as T

      Object.keys(o)
        .sort((a, b) => a.localeCompare(b))
        .forEach(k => {
          out[k as keyof T] = this.sortObjectDeep(o[k as keyof T])
        })

      return out
    }

    return o
  }

  /**
   * Optimized deep equality comparison with explicit typing and performance enhancements
   * Based on: https://github.com/epoberezkin/fast-deep-equal/
   *
   * Optimizations applied:
   * - Explicit typing to reduce runtime type checking
   * - Early returns to minimize call stack depth
   * - Cached key extraction to avoid duplicate Object.keys() calls
   * - Immutable patterns with readonly types
   * - Reduced instanceof checks through type guards
   */
  deepEquals(a: DeepComparable, b: DeepComparable): boolean {
    // Fast path: reference equality (most common case)
    if (a === b) return true

    // Fast path: handle primitives and null/undefined early
    if (a == null || b == null) return a === b
    if (typeof a !== 'object' || typeof b !== 'object') return a === b

    // Type guard: both are objects at this point
    const objA = a as ObjectWithKeys
    const objB = b as ObjectWithKeys

    // Array comparison with optimized loop
    const isArrA = isArray(objA)
    const isArrB = isArray(objB)

    if (isArrA !== isArrB) return false

    if (isArrA && isArrB) {
      const arrA = objA as readonly unknown[]
      const arrB = objB as readonly unknown[]
      const length = arrA.length

      // Early return for length mismatch
      if (length !== arrB.length) return false

      // Optimized loop: avoid function call overhead for small arrays
      for (let i = 0; i < length; i++) {
        if (
          !this.deepEquals(arrA[i] as DeepComparable, arrB[i] as DeepComparable)
        ) {
          return false
        }
      }
      return true
    }

    // Date comparison with type guards
    const isDateA = objA instanceof Date
    const isDateB = objB instanceof Date

    if (isDateA !== isDateB) return false
    if (isDateA && isDateB) {
      // Use valueOf() for better performance than getTime()
      return (objA as Date).valueOf() === (objB as Date).valueOf()
    }

    // RegExp comparison with type guards
    const isRegExpA = objA instanceof RegExp
    const isRegExpB = objB instanceof RegExp

    if (isRegExpA !== isRegExpB) return false
    if (isRegExpA && isRegExpB) {
      // Compare source and flags separately for better performance
      const regA = objA as RegExp
      const regB = objB as RegExp
      return regA.source === regB.source && regA.flags === regB.flags
    }

    // Object comparison with cached keys
    const keysA = getObjectKeys(objA)
    const keysB = getObjectKeys(objB)
    const length = keysA.length

    // Early return for key count mismatch
    if (length !== keysB.length) return false

    // Optimized property existence check
    for (let i = 0; i < length; i++) {
      const key = keysA[i]!
      if (!hasOwnProperty.call(objB, key)) return false
    }

    // Deep comparison of property values
    for (let i = 0; i < length; i++) {
      const key = keysA[i]!
      if (
        !this.deepEquals(
          objA[key] as DeepComparable,
          objB[key] as DeepComparable
        )
      ) {
        return false
      }
    }

    return true
  }
}

export const Objects = new ObjectsClass()
