import { IDataElement } from './BaseConnector'
import { Objects } from './Helpers/Objects'
import { PrimitivesArray } from './Providers/types'

export class Collection {
  public constructor(private data: IDataElement[] | PrimitivesArray) {}
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
  public avg(path?: string) {
    return this.average(path)
  }
  /**
   * Get the average value of a given key.
   *
   * @param  {String}  path Path of the key
   * @return static
   */
  public average(path: string = ''): number {
    const data = [...this.data]
    const sum: number = Number(
      data.reduce((acc: number, element) => {
        let value: number

        if (element instanceof Object) {
          const extract = Objects.getFromPath(element, path, undefined)
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

    this.chunks(size)

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
  public chunks(size) {
    const data = [...this.data]
    const results = []

    while (data.length) {
      results.push(data.splice(0, size))
    }

    this.data = results
    return this
  }
  /**
   *
   */
  public collapse() {
    const data = [...this.data]
    const results = []

    data.forEach(chunk => {
      if (Array.isArray(chunk)) {
        chunk.forEach(element => {
          results.push(element)
        })
      } else {
        results.push(chunk)
      }
    })
    this.data = results

    return this
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
  public concat(array) {
    this.data = [...this.data, ...array]
    return this
  }
  /**
   *
   * @param args
   */
  public contains(...args) {
    let value
    let path
    let Fx
    if (args.length === 1) {
      if (this.isFunction(args[0])) {
        Fx = args[0]
      }
      value = args[0]
    } else {
      value = args[1]
      path = args[0]
    }
    const data = [...this.data]

    return data.some((e, index) => {
      if (Fx) {
        return !!Fx(e, index)
      }
      let val = e
      if (e instanceof Object) {
        const extract = Objects.getFromPath(e, path, undefined)
        if (extract.value) {
          val = extract.value
        }
      }
      return val === value
    })
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
   */
  public count(): number {
    return this.data.length
  }
  /**
   *
   * @param functionToCheck
   */
  private isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
  }
}
