import { FalsyValue, Mapper, Predicate, StringMap } from './types'

export class ArraysClass {
  /**
   * Returns the first element of the array or a default value.
   * @param array The source array.
   * @param def The default value to return if the array is empty.
   * @returns The first element of the array or the default value.
   */
  first<T>(array: readonly T[], def?: T): T | undefined {
    return array.length > 0 ? array[0] : def
  }

  /**
   * Returns the last element of the array or a default value.
   * @param array The source array.
   * @param def The default value to return if the array is empty.
   * @returns The last element of the array or the default value.
   */

  last<T>(array: readonly T[], def?: T): T | undefined {
    if (array.length === 0) {
      return def
    }
    const lastElement = array[array.length - 1]
    return lastElement !== undefined ? lastElement : def
  }

  /**
   * Splits the array into chunks of the specified size.
   * @param array The source array.
   * @param size The size of every group.
   * @throws Will throw an error if `size` is less than or equal to 0.
   * @returns An array of chunks.
   */
  chunk<T>(array: readonly T[], size = 1): T[][] {
    if (size <= 0) {
      throw new Error('Size must be greater than 0')
    }

    const length = array.length
    if (length === 0) {
      return []
    }

    const results: T[][] = []
    let index = 0

    while (index < length) {
      results.push(array.slice(index, index + size))
      index += size
    }

    return results
  }

  /**
   * Removes duplicate values from the array.
   * @param array The source array.
   * @returns An array of unique values.
   */
  deDuplicate<T>(array: readonly T[]): T[] {
    return Array.from(new Set(array))
  }

  /**
   * Flattens an array of arrays into a single array.
   * @param array The array of arrays to flatten.
   * @returns A flattened array.
   */
  collapse<T>(array: T[][]): T[] {
    return array.flat()
  }

  /**
   * Groups the elements of an array based on the specified key.
   * @param items The array to group.
   * @param mapper A function that specifies the key to group by.
   * @returns An object containing the grouped elements.
   */
  groupBy<T>(items: readonly T[], mapper: Mapper<T, any>): StringMap<T[]> {
    const map = Object.create(null) as StringMap<T[]>
    for (let index = 0; index < items.length; index++) {
      const item = items[index]!
      const key = mapper(item, index) ?? 'undefined' // Coerce undefined to the string "undefined"
      if (!map[key]) {
        map[key] = []
      }
      map[key]!.push(item)
    }
    return map
  }

  /**
   * Sorts an array based on a mapper function.
   * @param items The array to sort.
   * @param mapper A function that specifies how to sort the elements.
   * @param mutate Determines whether to mutate the original array or return a new one.
   * @param descending Specifies the sort order.
   * @returns The sorted array.
   */
  sortBy<T>(
    items: T[],
    mapper: Mapper<T, any>,
    mutate = false,
    descending = false,
  ): T[] {
    const mod = descending ? -1 : 1
    const sortedItems = mutate ? items : [...items]
    const mappedCache = new Map<T, any>()

    // Pre-map all values to avoid indexOf calls in the sort comparator
    const indexMap = new Map<T, number>()
    for (let i = 0; i < sortedItems.length; i++) {
      indexMap.set(sortedItems[i]!, i)
    }

    return sortedItems.sort((a, b) => {
      let mappedA = mappedCache.get(a)
      if (mappedA === undefined) {
        mappedA = mapper(a, indexMap.get(a)!)
        mappedCache.set(a, mappedA)
      }

      let mappedB = mappedCache.get(b)
      if (mappedB === undefined) {
        mappedB = mapper(b, indexMap.get(b)!)
        mappedCache.set(b, mappedB)
      }

      if (typeof mappedA === 'number' && typeof mappedB === 'number') {
        return (mappedA - mappedB) * mod
      }
      return (
        String(mappedA).localeCompare(String(mappedB), undefined, {
          numeric: true,
        }) * mod
      )
    })
  }

  /**
   * Finds the last element in the array that satisfies the provided testing function.
   * @param items The source array.
   * @param predicate The function to test each element.
   * @returns The last element that passes the test, or undefined if no element passes.
   */
  findLast<T>(items: T[], predicate: Predicate<T>): T | undefined {
    for (let i = items.length - 1; i >= 0; i--) {
      if (predicate(items[i]!, i)) {
        return items[i]
      }
    }
    return undefined
  }

  /**
   * Counts the occurrences of distinct elements in the array based on a mapper function.
   * @param items The source array.
   * @param mapper A function to transform each element into a key to count by.
   * @returns An object with keys representing distinct elements and values their counts.
   */
  countBy<T>(items: T[], mapper: Mapper<T, any>): StringMap<number> {
    const acc = Object.create(null) as StringMap<number>
    for (let index = 0; index < items.length; index++) {
      const key = mapper(items[index]!, index)
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }

  /**
   * Calculates the sum of the elements in an array.
   * @param items The array of numbers to sum.
   * @returns The sum of the elements.
   */
  sum(items: number[]): number {
    let sum = 0
    for (let i = 0; i < items.length; i++) {
      sum += items[i]!
    }
    return sum
  }

  /**
   * Calculates the sum of the elements in an array based on a mapper function.
   * @param items The source array.
   * @param mapper A function to transform each element into a number to sum.
   * @returns The sum of the transformed elements.
   */
  sumBy<T>(items: T[], mapper: Mapper<T, number | undefined>): number {
    let sum = 0
    for (let i = 0; i < items.length; i++) {
      const value = mapper(items[i]!, i)
      if (typeof value === 'number') {
        sum += value
      }
    }
    return sum
  }

  /**
   * Converts an array into an object based on a mapper function.
   * @param array The source array.
   * @param mapper A function that returns a key-value pair for each element.
   * @returns An object with keys and values based on the mapper function.
   */
  mapToObject<T, V>(
    array: T[],
    mapper: (item: T) => [key: any, value: V] | FalsyValue,
  ): StringMap<V> {
    const acc = Object.create(null) as StringMap<V>
    for (let i = 0; i < array.length; i++) {
      const result = mapper(array[i]!)
      if (result) {
        const [key, value] = result
        acc[key] = value
      }
    }
    return acc
  }

  /**
   * Shuffles the elements of an array in place.
   * @param array The array to shuffle.
   * @param mutate Determines whether to mutate the original array or return a new one.
   * @returns The shuffled array.
   */
  shuffle<T>(array: T[], mutate = false): T[] {
    const result = mutate ? array : array.slice()
    for (let i = result.length - 1; i > 0; i--) {
      // random int in [0, i]
      const j = Math.floor(Math.random() * (i + 1))
      // type-safe swap without tuple destructure
      const tmp = result[i]!
      result[i] = result[j]!
      result[j] = tmp
    }
    return result
  }

  /**
   * Flattens an array of nested arrays to any depth.
   * @param array The nested array to be flattened.
   * @returns A new array with all nested arrays flattened.
   */
  flattenDeep<T>(array: any[]): T[] {
    const result: T[] = []
    const stack = [...array]

    while (stack.length) {
      const next = stack.pop()
      if (Array.isArray(next)) {
        stack.push(...next)
      } else {
        result.push(next)
      }
    }

    return result.reverse()
  }

  /**
   * Combines elements from multiple arrays based on their positions.
   * @param arrays An array of arrays to be combined.
   * @returns An array where each element is an array of corresponding elements from the input arrays.
   */
  zip(...arrays: any[][]): any[][] {
    const maxLength = Math.max(...arrays.map(arr => arr.length))
    return Array.from({ length: maxLength }, (_, index) =>
      arrays.map(arr => (index < arr.length ? arr[index] : undefined)),
    )
  }

  /**
   * Splits the array into two groups determined by a predicate function.
   * @param array The array to partition.
   * @param predicate The function used to determine the group allocation of each element.
   * @returns A tuple of two arrays: the first contains elements for which the predicate returned true, the second for which it returned false.
   */
  partition<T>(array: T[], predicate: Predicate<T>): [T[], T[]] {
    if (!Array.isArray(array)) {
      throw new TypeError('First argument must be an array')
    }
    const pass: T[] = []
    const fail: T[] = []
    for (let index = 0; index < array.length; index++) {
      const elem = array[index]!
      if (predicate(elem, index)) {
        pass.push(elem)
      } else {
        fail.push(elem)
      }
    }
    return [pass, fail]
  }

  /**
   * Creates an array of unique values, determined by a mapper function.
   * @param array The array to deduplicate.
   * @param mapper A function returning the value used for uniqueness comparison.
   * @returns An array of unique values.
   */
  uniqueBy<T, K>(array: T[], mapper: (element: T) => K): T[] {
    const set = new Set<K>()
    return array.filter(element => {
      const key = mapper(element)
      if (set.has(key)) {
        return false
      }
      set.add(key)
      return true
    })
  }

  /**
   * Finds the intersection of multiple arrays.
   * @param arrays An array of arrays to find the intersection of.
   * @returns An array of shared elements found in all input arrays.
   */
  intersection<T>(...arrays: T[][]): T[] {
    if (arrays.length === 0) {
      return []
    }
    if (arrays.length === 1) {
      return [...new Set(arrays[0])]
    }

    // Find the smallest array to minimize iterations
    let smallestIndex = 0
    let smallestSize = arrays[0]!.length
    for (let i = 1; i < arrays.length; i++) {
      if (arrays[i]!.length < smallestSize) {
        smallestSize = arrays[i]!.length
        smallestIndex = i
      }
    }

    // Start with the smallest array
    const result = new Set(arrays[smallestIndex])

    // Check each element against other arrays
    for (const element of result) {
      for (let i = 0; i < arrays.length; i++) {
        if (i === smallestIndex) {
          continue
        }
        if (!arrays[i]!.includes(element)) {
          result.delete(element)
          break
        }
      }
    }

    return Array.from(result)
  }

  /**
   * Finds the difference between the first array and additional arrays.
   * @param array The array to compare against others.
   * @param arrays Additional arrays to compare with the first.
   * @returns An array containing elements unique to the first array.
   */
  difference<T>(array: T[], ...arrays: T[][]): T[] {
    const otherElements = new Set<T>()
    for (const arr of arrays) {
      for (const element of arr) {
        otherElements.add(element)
      }
    }
    return array.filter(element => !otherElements.has(element))
  }

  /**
   * Removes all falsy values from an array.
   * @param array The array to compact.
   * @returns A new array with all falsy values removed.
   */
  compact<T>(array: T[]): T[] {
    return array.filter(Boolean)
  }

  /**
   * Concatenates multiple arrays into a single array.
   * @param arrays An array of arrays to concatenate.
   * @returns A new array consisting of all elements from the input arrays.
   */
  concatAll<T>(...arrays: T[][]): T[] {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
    const result = new Array<T>(totalLength)
    let index = 0

    for (const arr of arrays) {
      for (let i = 0; i < arr.length; i++) {
        result[index++] = arr[i]!
      }
    }

    return result
  }

  /**
   * Checks if an array is empty.
   * @param array The array to check.
   * @returns True if the array is empty, false otherwise.
   */
  isEmpty<T>(array: T[]): boolean {
    return array.length === 0
  }
}

export const Arrays = new ArraysClass()
