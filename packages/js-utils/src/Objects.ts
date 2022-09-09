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
const keyList = Object.keys
const hasProp = Object.prototype.hasOwnProperty
class ObjectsClass {
  /**
   * Given an Object and its path, it will return the
   * given path if it exists or the default
   * @param fn Function returning the nested Object
   * @param defaultValue
   */
  get = (fn: () => any, defaultValue?: any): any => {
    let value: any
    try {
      value = fn()
    } catch (e) {
      value = defaultValue
    }
    if (typeof value === 'undefined') {
      value = defaultValue
    }
    return value
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
    let pathArray = []

    if (path.includes(' as ')) {
      pathArray = path.split(' as ')
      PATH = pathArray[0]
    }

    const assignedName = this.get(
      () => pathArray.length > 0 && pathArray[1].trim(),
      undefined
    )

    const fullPath = PATH.replace(/\[/g, '.')
      .replace(/]/g, '')
      .split('.')
      .filter(Boolean)
      .map(e => e.trim())

    function everyFunc(step: any) {
      return !(step && (obj = obj[step]) === undefined)
    }

    const result = fullPath.every(everyFunc) ? obj : def

    return { label: assignedName || PATH, value: result }
  }

  /**
   * Given a nested Object it generates a flattened version using
   * dot notation. Custom notation can be assigned using the
   * keyFactory helper function
   * @param ob
   * @param keyFactory
   */
  flatten = (
    ob: { [key: string]: any },
    includeBaseKeys?: boolean,
    keyFactory: KeyFactory | null = null
  ): { [key: string]: any } => {
    if (keyFactory === null) {
      keyFactory = (previousKey, currentKey) => `${previousKey}.${currentKey}`
    }
    const toReturn: { [key: string]: string } = {}
    for (const i in ob) {
      if (!ob.hasOwnProperty(i)) {
        continue
      }
      if (typeof ob[i] === 'object') {
        const flatObject = this.flatten(ob[i])
        for (const x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) {
            continue
          }
          if (includeBaseKeys) {
            toReturn[i] = 'true'
          }
          toReturn[keyFactory(i, x)] = flatObject[x]
        }
      } else {
        toReturn[i] = ob[i]
      }
    }
    return toReturn
  }

  /**
   *
   * @param obj
   */
  isPlainObject = (obj: { [key: string]: any }) =>
    !!obj && obj.constructor === {}.constructor

  /**
   *
   * @param obj
   */
  getNestedObject = (obj: { [key: string]: any }, markNewObject: boolean) =>
    Object.entries(obj).reduce((result, [prop, val]) => {
      prop.split('.').reduce((nestedResult, prop, propIndex, propArray) => {
        const lastProp = propIndex === propArray.length - 1
        if (lastProp) {
          nestedResult[prop] = this.isPlainObject(val)
            ? this.getNestedObject(val, markNewObject)
            : val
        } else {
          nestedResult[prop] =
            nestedResult[prop] ||
            (markNewObject
              ? {
                  isObject: true
                }
              : {})
        }
        return nestedResult[prop]
      }, result)
      return result
    }, {})

  /**
   * Opposite of the flatten method. Given a nested dot notation flatten object.
   * it will generate the corresponding nested object
   * @param obj
   */
  nest = (
    obj: { [key: string]: any },
    markNewObject?: boolean
  ): { [key: string]: any } => {
    if (!obj) {
      return {}
    }
    return this.getNestedObject(obj, markNewObject || false)
  }

  /**
   * Deep clones a JS object using JSON.parse. This method
   * will not clone functions inside objects
   * @param {Object} object
   */
  clone = (object: { [key: string]: any }) => JSON.parse(JSON.stringify(object))

  /**
   * Given a value, it will check if it contains
   * none null, none undefined values inside
   * @param {string, Array, Object} value
   */
  isEmpty = (value: any): boolean => {
    if (typeof value === 'undefined' || value === null) {
      return true
    }

    if (typeof value === 'string' || Array.isArray(value)) {
      return !value.length
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
  deleteNulls = (object: { [key: string]: any }) => {
    const obj = object
    const isArray = obj instanceof Array

    for (const k in obj) {
      if (obj[k] === null) {
        isArray ? obj.splice(Number(k), 1) : delete obj[k]
      } else if (typeof obj[k] === 'object') {
        this.deleteNulls(obj[k])
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
   * Order of arguments in the predicate is different form _mapValues / _mapKeys!
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
    v: ValueOf<T>
  ): keyof T | undefined {
    return Object.entries(obj).find(([_, value]) => value === v)?.[0] as keyof T
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
   * Returns `undefined` if it's empty (according to `_isEmpty()` specification),
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
   * Based on: https://github.com/epoberezkin/fast-deep-equal/
   */
  deepEquals(a: any, b: any): boolean {
    if (a === b) return true

    if (a && b && typeof a == 'object' && typeof b == 'object') {
      const arrA = isArray(a)
      const arrB = isArray(b)
      let i
      let length
      let key

      if (arrA && arrB) {
        length = a.length
        if (length != b.length) return false
        for (i = length; i-- !== 0; )
          if (!this.deepEquals(a[i], b[i])) return false
        return true
      }

      if (arrA != arrB) return false

      const dateA = a instanceof Date
      const dateB = b instanceof Date
      if (dateA != dateB) return false
      if (dateA && dateB) return a.getTime() == b.getTime()

      const regexpA = a instanceof RegExp
      const regexpB = b instanceof RegExp
      if (regexpA != regexpB) return false
      if (regexpA && regexpB) return a.toString() == b.toString()

      const keys = keyList(a)
      length = keys.length

      if (length !== keyList(b).length) return false

      for (i = length; i-- !== 0; ) if (!hasProp.call(b, keys[i]!)) return false

      for (i = length; i-- !== 0; ) {
        key = keys[i]
        if (!this.deepEquals(a[key!], b[key!])) return false
      }

      return true
    }

    return a !== a && b !== b
  }
}

export const Objects = new ObjectsClass()
