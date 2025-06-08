import { StringMap, Mapper, Predicate, FalsyValue } from './types'

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

    const results: T[][] = []
    const elements = [...array]

    while (elements.length) {
      results.push(elements.splice(0, size))
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
    const results: T[] = []

    array.forEach(chunk => {
      results.push(...chunk)
    })

    return results
  }

  /**
   * Groups the elements of an array based on the specified key.
   * @param items The array to group.
   * @param mapper A function that specifies the key to group by.
   * @returns An object containing the grouped elements.
   */
  groupBy<T>(items: readonly T[], mapper: Mapper<T, any>): StringMap<T[]> {
    return items.reduce((map, item, index) => {
      const key = mapper(item, index) ?? 'undefined' // Coerce undefined to the string "undefined"
      map[key] = map[key] || []

      map[key]?.push(item)
      return map
    }, {} as StringMap<T[]>)
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
    descending = false
  ): T[] {
    const mod = descending ? -1 : 1
    const sortedItems = mutate ? items : [...items]
    return sortedItems.sort((a, b) => {
      const mappedA = mapper(a, sortedItems.indexOf(a))
      const mappedB = mapper(b, sortedItems.indexOf(b))
      if (typeof mappedA === 'number' && typeof mappedB === 'number') {
        return (mappedA - mappedB) * mod
      }
      return (
        String(mappedA).localeCompare(String(mappedB), undefined, {
          numeric: true
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
    return [...items].reverse().find(predicate)
  }

  /**
   * Counts the occurrences of distinct elements in the array based on a mapper function.
   * @param items The source array.
   * @param mapper A function to transform each element into a key to count by.
   * @returns An object with keys representing distinct elements and values their counts.
   */
  countBy<T>(items: T[], mapper: Mapper<T, any>): StringMap<number> {
    return items.reduce((acc, item, index) => {
      const key = mapper(item, index)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as StringMap<number>)
  }

  /**
   * Calculates the sum of the elements in an array.
   * @param items The array of numbers to sum.
   * @returns The sum of the elements.
   */
  sum(items: number[]): number {
    return items.reduce((sum, n) => sum + n, 0)
  }

  /**
   * Calculates the sum of the elements in an array based on a mapper function.
   * @param items The source array.
   * @param mapper A function to transform each element into a number to sum.
   * @returns The sum of the transformed elements.
   */
  sumBy<T>(items: T[], mapper: Mapper<T, number | undefined>): number {
    return items
      .map(mapper)
      .filter((value): value is number => typeof value === 'number')
      .reduce((sum, n) => sum + n, 0)
  }

  /**
   * Converts an array into an object based on a mapper function.
   * @param array The source array.
   * @param mapper A function that returns a key-value pair for each element.
   * @returns An object with keys and values based on the mapper function.
   */
  mapToObject<T, V>(
    array: T[],
    mapper: (item: T) => [key: any, value: V] | FalsyValue
  ): StringMap<V> {
    return array.reduce((acc, item) => {
      const result = mapper(item)
      if (result) {
        const [key, value] = result
        acc[key] = value
      }
      return acc
    }, {} as StringMap<V>)
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
    return array.reduce(
      (acc: T[], val: any) =>
        Array.isArray(val)
          ? acc.concat(this.flattenDeep(val))
          : acc.concat(val),
      []
    )
  }

  /**
   * Combines elements from multiple arrays based on their positions.
   * @param arrays An array of arrays to be combined.
   * @returns An array where each element is an array of corresponding elements from the input arrays.
   */
  zip(...arrays: Array<any[]>): Array<Array<any>> {
    const maxLength = Math.max(...arrays.map(arr => arr.length))
    return Array.from({ length: maxLength }, (_, index) =>
      arrays.map(arr => (index < arr.length ? arr[index] : undefined))
    )
  }

  /**
   * Splits the array into two groups determined by a predicate function.
   * @param array The array to partition.
   * @param predicate The function used to determine the group allocation of each element.
   * @returns A tuple of two arrays: the first contains elements for which the predicate returned true, the second for which it returned false.
   */
  partition<T>(array: T[], predicate: Predicate<T>): [T[], T[]] {
    return array.reduce(
      ([pass, fail], elem, index) => {
        return predicate(elem, index)
          ? [[...pass, elem], fail]
          : [pass, [...fail, elem]]
      },
      [[], []] as [T[], T[]]
    )
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
    // Get the first array
    const firstArray = arrays.shift() || []

    // Filter unique elements from the first array
    const uniqueElements = new Set(firstArray)

    // Iterate through other arrays and filter elements that exist in all arrays
    for (const array of arrays) {
      const currentSet = new Set(array)
      for (const element of uniqueElements) {
        if (!currentSet.has(element)) {
          uniqueElements.delete(element)
        }
      }
    }

    return Array.from(uniqueElements)
  }

  /**
   * Finds the difference between the first array and additional arrays.
   * @param array The array to compare against others.
   * @param arrays Additional arrays to compare with the first.
   * @returns An array containing elements unique to the first array.
   */
  difference<T>(array: T[], ...arrays: T[][]): T[] {
    const otherElements = new Set(arrays.flat())
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
    return arrays.flat()
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
