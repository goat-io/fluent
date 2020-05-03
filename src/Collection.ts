import { IDataElement } from './BaseConnector'
import { Objects } from './Helpers/Objects'
import { Primitives } from './Providers/types'

// Original source
// https://www.manongdao.com/article-1769839.html

type Cons<H, T> = T extends readonly any[]
  ? ((h: H, ...t: T) => void) extends (...r: infer R) => void
    ? R
    : never
  : never

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]]

export type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: [K] | (Paths<T[K], Prev[D]> extends infer P ? (P extends [] ? never : Cons<K, P>) : never)
    }[keyof T]
  : []

type Leaves<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Cons<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : []

type Contains<T> = {
  value?: Primitives
  path?: Paths<T>
  Fx?(element: T, index: number): boolean
}

export class Collection<T = IDataElement | Primitives> {
  public constructor(private data: T[]) {}
  /**
   *
   */
  public get() {
    return this.data
  }
  /**
   * Alias for the "get" method
   * @return function
   */
  public all() {
    return this.get()
  }
  /**
   * Alias for the "average" method.
   *
   * @param  {String}  path Path of the key
   * @return function
   */
  public avg(path?: Paths<T>) {
    return this.average(path)
  }
  /**
   * Get the average value of a given key.
   *
   * @param  {String}  path Path of the key
   * @return static
   */
  public average(path?: Paths<T>): number {
    const stringPath = path && path.join('.')
    const data = [...this.data]
    const sum: number = Number(
      data.reduce((acc: number, element) => {
        let value: number

        if (element instanceof Object) {
          const extract = Objects.getFromPath(element, stringPath, undefined)
          if (typeof extract !== 'undefined' && extract.value) {
            value = extract.value
          }
        } else {
          value = Number(element)
        }

        return acc + value
      }, 0)
    )

    try {
      const avg = sum / data.length
      return avg
    } catch (e) {
      throw new Error('Division between "' + sum + '" and "' + data.length + '" is not valid.')
    }
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

    const reducer = (chain, batch) =>
      chain
        .then(() => Promise.all(batch.map((d) => callback(d))))
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
    const data = [...this.data]
    const results: T[][] = []

    while (data.length) {
      results.push(data.splice(0, size))
    }

    return new Collection<T[]>(results)
  }
  /**
   *
   */
  public collapse() {
    const data = [...this.data]
    const results: T[] = []

    data.forEach((chunk) => {
      if (Array.isArray(chunk)) {
        chunk.forEach((element) => {
          results.push(element)
        })
      } else {
        results.push(chunk)
      }
    })

    return new Collection<T>(results)
  }
  /**
   *
   */
  public unChunk() {
    return this.collapse()
  }
  /*public combine(array) {
    const data = [...this.data]
    let result
    data.forEach((e, index) => {
      if (!(e instanceof Object) && typeof e !== 'boolean') {
        if (!result) {
          result = {}
        }
        result[e] = array[index]
      } else {
        if (!result) {
          result = []
        }
        result[index] = { ...e, _value: array[index] }
      }
    })

    this.data = result
    return this
  }*/
  public concat(array: T[]) {
    this.data = [...this.data, ...array]
    return this
  }
  /**
   *
   * @param args
   */
  public contains(contains: Contains<T>): boolean {
    const data = [...this.data]

    if (!contains.Fx && !contains.value) {
      throw new Error('No Function nor value to compare. Please add one of them')
    }

    return data.some((element, index) => {
      if (contains.Fx) {
        return !!contains.Fx(element, index)
      }

      if (element instanceof Object) {
        const stringPath = contains.path && contains.path.join('.')
        const extract = Objects.getFromPath(element, stringPath, undefined)
        if (extract.value) {
          return extract.value === contains.value
        }
      }

      if (typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
        return element === contains.value
      }
    })
  }
  /**
   *
   */
  public count(): number {
    return this.data.length
  }
  /**
   * Returns an array of duplicate submissions, based on an array of keys.
   * @param {Array} keys - Keys where the function compares an object to evaluate its similarity.
   */
  public duplicatesBy(keys: string[]) {
    const data = [...this.data]
    const duplicates = []

    data.reduce((object, submission) => {
      const finalKey = keys.reduce((s: string, key) => s + Objects.getFromPath(submission, key, '').value, '')

      if (object.hasOwnProperty(finalKey)) {
        duplicates.push(submission)
      } else {
        object[finalKey] = true
      }

      return object
    }, {})

    this.data = duplicates

    return this
  }

  /**
   *
   * @param functionToCheck
   */
  private isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
  }
}
