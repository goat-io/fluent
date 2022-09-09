import { StringMap, Mapper, Predicate, FalsyValue } from './types'

class ArraysClass {
  /**
   * Return the first element in an array or the default.
   *
   * @param  iterable  array
   * @param  mixed  def
   * @return mixed
   */
  first<T>(array: readonly T[], def?: T): T {
    if (array && Array.isArray(array) && array[0]) {
      return array[0]
    }
    return def
  }

  /**
   * Return the last element in an array.
   *
   * @param  array  $array
   * @param  callable|null  $callback
   * @param  mixed  $default
   * @return mixed
   */
  last<T>(array: readonly T[], def?: T): T {
    if (array && Array.isArray(array) && array[array.length - 1]) {
      return array[array.length - 1]
    }
    return def
  }

  /**
   *
   * @param data
   * @param size
   */
  chunk<T>(array: readonly T[], size = 1): T[][] {
    const results: any[][] = []
    const elements = [...array]

    while (elements.length) {
      results.push(elements.splice(0, size))
    }

    return results
  }

  deDuplicate<T>(array: readonly T[]): T[] {
    return [...new Set(array)]
  }

  /**
   *
   * @param data
   */
  collapse<T>(array: T[][]): T[] {
    const elements = [...array]
    const results: any[] = []

    elements.forEach(c => {
      if (Array.isArray(c)) {
        c.forEach(element => {
          results.push(element)
        })
      } else {
        results.push(c)
      }
    })

    return results
  }

  groupBy<T>(items: readonly T[], mapper: Mapper<T, any>): StringMap<T[]> {
    return items.reduce((map, item, index) => {
      const res = mapper(item, index)
      if (res !== undefined) {
        map[res] = [...(map[res] || []), item]
      }
      return map
    }, {} as StringMap<T[]>)
  }

  sortBy<T>(
    items: T[],
    mapper: Mapper<T, any>,
    mutate = false,
    descending = false
  ): T[] {
    const mod = descending ? -1 : 1
    return (mutate ? items : [...items]).sort((_a, _b) => {
      const [a, b] = [_a, _b].map(mapper) // eslint-disable-line unicorn/no-array-callback-reference
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * mod
      return String(a).localeCompare(String(b)) * mod
    })
  }

  findLast<T>(items: T[], predicate: Predicate<T>): T | undefined {
    return [...items].reverse().find(predicate) // eslint-disable-line unicorn/no-array-callback-reference
  }

  countBy<T>(items: T[], mapper: Mapper<T, any>): StringMap<number> {
    const map: StringMap<number> = {}

    items.forEach((item, index) => {
      const key = mapper(item, index)
      map[key] = (map[key] || 0) + 1
    })

    return map
  }

  sum(items: number[]): number {
    return items.reduce((sum, n) => sum + n, 0)
  }

  sumBy<T>(items: T[], mapper: Mapper<T, number | undefined>): number {
    return items
      .map((v, i) => mapper(v, i)!)
      .filter(i => typeof i === 'number') // count only numbers, nothing else
      .reduce((sum, n) => sum + n, 0)
  }

  mapToObject<T, V>(
    array: T[],
    mapper: (item: T) => [key: any, value: V] | FalsyValue
  ): StringMap<V> {
    const m: StringMap<V> = {}

    array.forEach(item => {
      const r = mapper(item)
      if (!r) return // filtering

      m[r[0]] = r[1]
    })

    return m
  }

  shuffle<T>(array: T[], mutate = false): T[] {
    const a = mutate ? array : [...array]

    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }

    return a
  }
}

export const Arrays = new ArraysClass()
