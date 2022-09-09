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
  public constructor(private data: T[]) {}

  public static collect<T = AnyObject | Primitives>(data: T[]): Collection<T> {
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
    const stringP = path ? path(this.generatedKeyPath) : ''
    const stringPath = stringP.toString()
    const data = [...this.data]

    const sum = Number(
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
      throw new Error(
        `Division between "${sum}" and "${data.length}" is not valid.`
      )
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
        .then(() => Promise.all(batch.map(d => callback(d))))
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
    const results = Arrays.chunk([...this.data], size)
    return new Collection<T[]>(results)
  }

  /**
   *
   */
  public collapse() {
    const data = [...this.data] as unknown as T[][]

    return new Collection<T>(Arrays.collapse(data))
  }

  /**
   *
   */
  public unChunk() {
    return this.collapse()
  }

  /* public combine(array) {
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
  } */
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
      throw new Error(
        'No Function nor value to compare. Please add one of them'
      )
    }

    return data.some((element, index) => {
      if (contains.Fx) {
        return !!contains.Fx(element, index)
      }

      if (element instanceof Object) {
        const stringP = contains.path
          ? contains.path(this.generatedKeyPath)
          : ''
        const stringPath = stringP.toString()

        const extract = Objects.getFromPath(element, stringPath, undefined)
        if (extract.value) {
          return extract.value === contains.value
        }
      }

      if (
        typeof element === 'string' ||
        typeof element === 'number' ||
        typeof element === 'boolean'
      ) {
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
      const finalKey = keys.reduce(
        (s: string, key) => s + Objects.getFromPath(submission, key, '').value,
        ''
      )

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
    return (
      functionToCheck &&
      {}.toString.call(functionToCheck) === '[object Function]'
    )
  }
}
