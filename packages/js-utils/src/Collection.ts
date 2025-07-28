import { typedPath } from 'typed-path'
import { AnyObject, Primitives, TypedKeys } from './types'
import { Objects } from './Objects'
import { Arrays } from './Arrays'

type Contains<T> = {
  value?: Primitives
  path?: TypedKeys<T>
  Fx?(element: T, index: number): boolean
}

export class Collection<T = AnyObject | Primitives> {
  private data: T[]

  public constructor(data: T[] = []) {
    this.data = data
  }

  public static collect<T = AnyObject | Primitives>(
    data: T[] = []
  ): Collection<T> {
    return new Collection(data)
  }

  public generatedKeyPath = typedPath<T>()

  /**
   *
   */
  public get(): T[] {
    return this.data
  }

  /**
   * Alias for the "get" method
   * @return function
   */
  public all(): T[] {
    return this.get()
  }

  /**
   * Alias for the "average" method.
   *
   * @param  {String}  path Path of the key
   * @return function
   */
  public avg(path?: TypedKeys<T>) {
    return this.average(path)
  }

  /**
   * Get the average value of a given key.
   *
   * @param  {String}  path Path of the key
   * @return static
   */
  public average(path?: TypedKeys<T>): number {
    const length = this.data.length
    if (length === 0) return 0
    
    let sum = 0

    if (path) {
      const stringPath = path(this.generatedKeyPath).toString()
      for (let i = 0; i < length; i++) {
        const element = this.data[i]!
        if (typeof element === 'object' && element !== null) {
          const extract = Objects.getFromPath(element, stringPath, undefined)
          if (typeof extract !== 'undefined' && extract.value) {
            sum += Number(extract.value)
          }
        }
      }
    } else {
      for (let i = 0; i < length; i++) {
        sum += Number(this.data[i])
      }
    }

    return sum / length
  }

  /**
   *
   * @param size
   * @param callback
   */
  public async chunkApply(size: number, callback: (d: any) => void) {
    if (callback === undefined) {
      throw new Error('Callback function not defined.')
    }

    const totalSize = this.data.length
    let count = 0

    this.chunk(size)

    const reducer = (chain: any, batch: any) =>
      chain
        .then(() => Promise.all(batch.map((d: any) => callback(d))))
        .then(() => {
          count = count + size > totalSize ? totalSize : count + size
          console.log(`Processed ${count}/${totalSize} elements...`)
        })

    console.log(`Processed ${count}/${totalSize} elements...`)
    const data = [...this.data]
    const promiseChain = data.reduce(reducer, Promise.resolve())

    return promiseChain
  }

  /**
   * Chunks the given array
   *
   * @param {Int} size
   * @return static
   */
  public chunk(size: number) {
    const results = Arrays.chunk(this.data, size)
    return new Collection<T[]>(results)
  }

  /**
   *
   */
  public collapse() {
    const data = this.data as unknown as T[][]
    return new Collection<T>(Arrays.collapse(data))
  }

  /**
   *
   */
  public unChunk() {
    return this.collapse()
  }

  public combine<K extends string | number, U>(
    values: U[]
  ): Collection<Record<string, U>> {
    const keys = this.data as unknown as K[]
    const len = keys.length
    if (len !== values.length) {
      throw new Error('The array to combine with must be of the same length.')
    }

    const combined = Object.create(null) as Record<string, U>
    for (let idx = 0; idx < len; idx++) {
      combined[String(keys[idx]!)] = values[idx]!
    }

    return new Collection([combined])
  }

  public concat<U>(values: U[] | Collection<U>): Collection<T | U> {
    // Extracting the array from the Collection if needed
    const arrayValues = values instanceof Collection ? values.get() : values

    // Since T and U can be different, we treat them as a union type (T | U)
    const concatenated: Array<T | U> = [...this.data, ...arrayValues]

    return new Collection<T | U>(concatenated)
  }

  /**
   *
   * @param args
   */
  public contains(predicate: Contains<T>): boolean {
    const { value, path, Fx } = predicate
    if (!Fx && value === undefined && !path) {
      throw new Error(
        'No Function nor value to compare. Please add one of them'
      )
    }

    for (let i = 0; i < this.data.length; i++) {
      const elem = this.data[i]

      if (Fx) {
        if (Fx(elem as T, i)) return true
        continue
      }

      let elemValue: any
      if (value === undefined) {
        elemValue = undefined
      } else if (elem !== null && typeof elem === 'object') {
        const stringPath = path?.(this.generatedKeyPath).toString() ?? ''
        const extract = Objects.getFromPath(
          elem as AnyObject,
          stringPath,
          undefined
        )
        elemValue = extract.value
      } else {
        elemValue = elem as unknown as Primitives
      }

      if (elemValue === value) return true
    }

    return false
  }

  /**
   *
   */
  public count(): number {
    return this.data.length
  }

  public countBy(
    callback?: (item: T) => string | number
  ): Collection<{ [key: string]: number }> {
    const counts = Object.create(null) as { [key: string]: number }
    const length = this.data.length
    
    for (let i = 0; i < length; i++) {
      const item = this.data[i]!
      const key = String(callback ? callback(item) : item)
      counts[key] = (counts[key] || 0) + 1
    }
    
    return new Collection([counts])
  }

  public crossJoin<U>(
    ...arrays: Array<U[] | Collection<U>>
  ): Collection<Array<T | U>> {
    const first = this.data as Array<T>
    const rest = arrays.map(a =>
      a instanceof Collection ? a.get() : a
    ) as Array<U[]>

    const inputs = [first, ...rest] as Array<Array<T | U>>

    if (inputs.some(arr => arr.length === 0)) {
      return new Collection<Array<T | U>>([])
    }

    const total = inputs.reduce((acc, arr) => acc * arr.length, 1)
    const result: Array<Array<T | U>> = new Array(total)
    const prefix: (T | U)[] = new Array(inputs.length)

    function rec(level: number, offset: number, stride: number): void {
      const arr = inputs[level]
      const len = arr?.length || 0
      const nextStride = stride / len

      for (let i = 0; i < len; i++) {
        const val = arr?.[i]!

        prefix[level] = val
        const nextOffset = offset + i * nextStride

        if (level + 1 === inputs.length) {
          result[nextOffset] = prefix.slice(0, inputs.length)
        } else {
          rec(level + 1, nextOffset, nextStride)
        }
      }
    }

    rec(0, 0, total)
    return new Collection(result)
  }

  public diff<U>(items: U[] | Collection<U>): Collection<T> {
    const arrayItems = items instanceof Collection ? items.get() : items
    const itemSet = new Set()
    const objectCache = new Map()
    
    // Build lookup structures
    for (const item of arrayItems) {
      if (typeof item === 'object' && item !== null) {
        objectCache.set(JSON.stringify(item), true)
      } else {
        itemSet.add(item)
      }
    }

    const diffArray: T[] = []
    for (const item of this.data) {
      let found = false
      if (typeof item === 'object' && item !== null) {
        found = objectCache.has(JSON.stringify(item))
      } else {
        found = itemSet.has(item)
      }
      if (!found) {
        diffArray.push(item)
      }
    }

    return new Collection(diffArray)
  }

  // public dot(): Collection<{ [key: string]: any }> {
  //   const result: Array<{ [key: string]: any }> = []

  //   const recurse = (
  //     obj: any,
  //     current: string,
  //     result: { [key: string]: any }
  //   ) => {
  //     if (Array.isArray(obj)) {
  //       obj.forEach((value, index) => {
  //         const newKey = `${current}.${index}`
  //         if (typeof value === 'object' && !Array.isArray(value)) {
  //           recurse(value, newKey, result)
  //         } else {
  //           // Directly assign primitives or arrays without further flattening
  //           result[newKey] = value
  //         }
  //       })
  //     } else {
  //       Object.keys(obj).forEach(key => {
  //         const value = obj[key]
  //         const newKey = current ? `${current}.${key}` : key
  //         if (typeof value === 'object' && !Array.isArray(value)) {
  //           recurse(value, newKey, result)
  //         } else {
  //           result[newKey] = value
  //         }
  //       })
  //     }
  //   }

  //   this.data.forEach(item => {
  //     let flatItem: { [key: string]: any } = {}
  //     recurse(item, '', flatItem)
  //     result.push(flatItem)
  //   })

  //   return new Collection(result)
  // }

  /**
   * Returns an array of duplicate submissions, based on an array of keys.
   * @param {Array} keys - Keys where the function compares an object to evaluate its similarity.
   */
  public duplicatesBy(keys: string[]): this {
    const duplicates: T[] = []
    const seen = new Set<string>()

    for (const item of this.data) {
      const keyParts = new Array(keys.length)
      for (let i = 0; i < keys.length; i++) {
        keyParts[i] = Objects.getFromPath(item, keys[i]!, '').value
      }
      const finalKey = keyParts.join('|')

      if (seen.has(finalKey)) {
        duplicates.push(item)
      } else {
        seen.add(finalKey)
      }
    }

    this.data = duplicates
    return this
  }

  /**
   *
   * @param functionToCheck
   */
  public isFunction(functionToCheck: any) {
    return (
      functionToCheck &&
      {}.toString.call(functionToCheck) === '[object Function]'
    )
  }
}
