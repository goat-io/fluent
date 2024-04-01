// yarn test arrays.spec.ts
import { Arrays, ArraysClass } from './Arrays'

const arrays = new ArraysClass()

describe('ArraysClass', () => {
  describe('first', () => {
    it('returns the first element of a non-empty array', () => {
      expect(arrays.first([1, 2, 3])).toBe(1)
    })

    it('returns undefined for an empty array when no default is provided', () => {
      expect(arrays.first([])).toBeUndefined()
    })

    it('returns the first element regardless of the element type', () => {
      const obj = { key: 'value' }
      const array = [obj, 'string', 42]
      expect(arrays.first(array)).toBe(obj)
    })

    it('returns the default value when provided for an empty array', () => {
      expect(arrays.first([], 'default')).toBe('default')
    })

    it('returns the only element in a single-element array', () => {
      expect(arrays.first(['single'])).toBe('single')
    })

    it('ignores the default value if the array is not empty', () => {
      expect(arrays.first([1, 2, 3], 1)).toBe(1)
    })
  })

  describe('last', () => {
    const arrays = new ArraysClass()

    it('returns the last element of a non-empty array of numbers', () => {
      expect(arrays.last([1, 2, 3])).toBe(3)
    })

    it('returns the last element of a non-empty array of strings', () => {
      expect(arrays.last(['a', 'b', 'c'])).toBe('c')
    })

    it('returns the last element of a non-empty array of mixed types', () => {
      expect(arrays.last([1, 'b', true])).toBe(true)
    })

    it('returns undefined for an empty array when no default is provided', () => {
      expect(arrays.last([])).toBeUndefined()
    })

    it('returns the default value for an empty array when provided', () => {
      expect(arrays.last([], 'default')).toBe('default')
    })

    it('returns the only element in a single-element array', () => {
      expect(arrays.last(['single'])).toBe('single')
    })

    it('ignores the default value if the array is not empty', () => {
      expect(arrays.last([1, 2, 3], 3)).toBe(3)
    })

    it('returns the last element of an array of objects', () => {
      const obj1 = { key: 'value1' }
      const obj2 = { key: 'value2' }
      expect(arrays.last([obj1, obj2])).toBe(obj2)
    })

    it('returns the default value when provided for an array of objects', () => {
      const obj = { key: 'value' }
      expect(arrays.last([], obj)).toEqual(obj)
    })

    it('handles arrays containing null and undefined values', () => {
      expect(arrays.last([null, undefined, 'value'])).toBe('value')
      expect(arrays.last([null, undefined], 'default')).toBe('default')
    })
  })

  describe('chunk', () => {
    const arrays = new ArraysClass()

    it('divides an array into chunks of a specified size', () => {
      expect(arrays.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })

    it('handles arrays that do not divide evenly by the chunk size', () => {
      expect(arrays.chunk([1, 2, 3, 4, 5], 3)).toEqual([
        [1, 2, 3],
        [4, 5]
      ])
    })

    it('correctly handles the case when the array length is less than the chunk size', () => {
      expect(arrays.chunk([1, 2], 3)).toEqual([[1, 2]])
    })

    it('handles chunk size of 1', () => {
      expect(arrays.chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]])
    })

    it('throws an error for zero or negative chunk size', () => {
      expect(() => arrays.chunk([1, 2, 3], 0)).toThrow(
        'Size must be greater than 0'
      )
      expect(() => arrays.chunk([1, 2, 3], -1)).toThrow(
        'Size must be greater than 0'
      )
    })

    it('returns an empty array when the input array is empty', () => {
      expect(arrays.chunk([], 2)).toEqual([])
    })

    it('does not modify the original array', () => {
      const original = [1, 2, 3, 4, 5]
      arrays.chunk(original, 2)
      expect(original).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('deDuplicate', () => {
    const arrays = new ArraysClass()

    it('removes duplicate numbers from an array', () => {
      expect(arrays.deDuplicate([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    })

    it('removes duplicate strings from an array', () => {
      expect(arrays.deDuplicate(['a', 'b', 'a', 'b', 'c'])).toEqual([
        'a',
        'b',
        'c'
      ])
    })

    it('does not remove objects based on value equality', () => {
      const obj = { key: 'value' }
      expect(arrays.deDuplicate([obj, obj, { key: 'value' }])).toEqual([
        obj,
        { key: 'value' }
      ])
    })

    it('handles arrays with mixed types', () => {
      expect(arrays.deDuplicate([1, '1', 1, '1'])).toEqual([1, '1'])
    })

    it('returns an empty array when the input is empty', () => {
      expect(arrays.deDuplicate([])).toEqual([])
    })

    it('does not modify the original array', () => {
      const original = [1, 2, 2, 3]
      arrays.deDuplicate(original)
      expect(original).toEqual([1, 2, 2, 3])
    })
  })

  describe('collapse', () => {
    const arrays = new ArraysClass()

    it('flattens a two-dimensional array', () => {
      expect(arrays.collapse([[1, 2], [3, 4], [5]])).toEqual([1, 2, 3, 4, 5])
    })

    it('flattens arrays with varying lengths', () => {
      expect(arrays.collapse([[1], [2, 3], [4, 5, 6]])).toEqual([
        1, 2, 3, 4, 5, 6
      ])
    })

    it('handles empty arrays within the main array', () => {
      expect(arrays.collapse([[], [1, 2], []])).toEqual([1, 2])
    })

    it('returns an empty array when the input is an empty array', () => {
      expect(arrays.collapse([])).toEqual([])
    })

    it('does not modify the original array', () => {
      const original = [
        [1, 2],
        [3, 4]
      ]
      arrays.collapse(original)
      expect(original).toEqual([
        [1, 2],
        [3, 4]
      ])
    })
  })

  describe('groupBy', () => {
    const arrays = new ArraysClass()

    it('groups numbers by their modulo 2 value', () => {
      expect(arrays.groupBy([1, 2, 3, 4, 5], num => num % 2)).toEqual({
        '1': [1, 3, 5],
        '0': [2, 4]
      })
    })

    it('groups strings by their first letter', () => {
      expect(
        arrays.groupBy(['carrot', 'apple', 'banana'], str => str.charAt(0))
      ).toEqual({
        c: ['carrot'],
        a: ['apple'],
        b: ['banana']
      })
    })

    it('returns an empty object for an empty array', () => {
      expect(arrays.groupBy([], item => item)).toEqual({})
    })

    it('handles grouping by a non-primitive property', () => {
      const item1 = { type: 'fruit', name: 'apple' }
      const item2 = { type: 'vegetable', name: 'carrot' }
      const item3 = { type: 'fruit', name: 'banana' }
      expect(arrays.groupBy([item1, item2, item3], item => item.type)).toEqual({
        fruit: [item1, item3],
        vegetable: [item2]
      })
    })

    it('groups items with undefined mapper result into undefined key', () => {
      expect(
        arrays.groupBy([1, 2, 3], num => (num > 3 ? 'greater' : undefined))
      ).toEqual({
        undefined: [1, 2, 3]
      })
    })

    it('applies the mapper function with index', () => {
      expect(
        arrays.groupBy(['a', 'b', 'c'], (item, index) => index % 2)
      ).toEqual({
        '0': ['a', 'c'],
        '1': ['b']
      })
    })
  })

  describe('sortBy', () => {
    const arrays = new ArraysClass()

    it('sorts an array of numbers in ascending order', () => {
      expect(arrays.sortBy([3, 1, 4, 1], x => x)).toEqual([1, 1, 3, 4])
    })

    it('sorts an array of strings in ascending order', () => {
      expect(arrays.sortBy(['banana', 'apple', 'carrot'], x => x)).toEqual([
        'apple',
        'banana',
        'carrot'
      ])
    })

    it('sorts by a property of an object', () => {
      const arr = [{ age: 30 }, { age: 20 }, { age: 40 }]
      expect(arrays.sortBy(arr, item => item.age)).toEqual([
        { age: 20 },
        { age: 30 },
        { age: 40 }
      ])
    })

    it('sorts in descending order when specified', () => {
      expect(arrays.sortBy([3, 1, 4, 1], x => x, false, true)).toEqual([
        4, 3, 1, 1
      ])
    })

    it('does not mutate the original array by default', () => {
      const arr = [3, 1, 4, 1]
      arrays.sortBy(arr, x => x)
      expect(arr).toEqual([3, 1, 4, 1])
    })

    it('mutates the original array when mutate is true', () => {
      const arr = [3, 1, 4, 1]
      arrays.sortBy(arr, x => x, true)
      expect(arr).toEqual([1, 1, 3, 4])
    })

    it('sorts using a secondary criterion', () => {
      const arr = [
        { age: 20, name: 'John' },
        { age: 20, name: 'Jane' },
        { age: 30, name: 'Alice' }
      ]
      // Sorting by age first, and then by name if ages are equal
      expect(arrays.sortBy(arr, item => `${item.age}-${item.name}`)).toEqual([
        { age: 20, name: 'Jane' },
        { age: 20, name: 'John' },
        { age: 30, name: 'Alice' }
      ])
    })

    it('handles sorting with non-uniform return types from the mapper', () => {
      const arr = [3, '2', 1]
      expect(() => arrays.sortBy(arr, x => x)).not.toThrow()
    })
  })

  describe('findLast', () => {
    const arrays = new ArraysClass()

    it('finds the last element that meets the condition', () => {
      expect(arrays.findLast([1, 2, 3, 4], x => x % 2 === 0)).toBe(4)
    })

    it('returns undefined if no element meets the condition', () => {
      expect(arrays.findLast([1, 3, 5], x => x % 2 === 0)).toBeUndefined()
    })

    it('considers the last element first', () => {
      expect(arrays.findLast([2, 3, 4, 6, 7], x => x % 2 === 0)).toBe(6)
    })

    it('works with an array of objects', () => {
      const arr = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]
      expect(arrays.findLast(arr, x => x.value > 2)).toEqual({ value: 4 })
    })

    it('returns undefined for an empty array', () => {
      expect(arrays.findLast([], x => x > 2)).toBeUndefined()
    })

    it('handles all elements being undefined', () => {
      expect(
        arrays.findLast([undefined, undefined], x => x !== undefined)
      ).toBeUndefined()
    })

    it('processes an array with multiple types', () => {
      expect(
        arrays.findLast([1, 'two', 3, 'four'], x => typeof x === 'string')
      ).toBe('four')
    })
  })

  describe('countBy', () => {
    const arrays = new ArraysClass()

    it('counts occurrences of numbers based on a simple value', () => {
      expect(arrays.countBy([1, 2, 2, 3, 3, 3], x => x)).toEqual({
        '1': 1,
        '2': 2,
        '3': 3
      })
    })

    it('counts occurrences of strings based on their length', () => {
      // Double-check this array is correct and has not been altered.
      const inputArray = ['one', 'two', 'three', 'four', 'five']
      const result = arrays.countBy(inputArray, str => str.length)
      expect(result).toEqual({ '3': 2, '4': 2, '5': 1 })
    })

    it('counts occurrences based on a property of objects', () => {
      const arr = [
        { type: 'fruit', name: 'apple' },
        { type: 'vegetable', name: 'carrot' },
        { type: 'fruit', name: 'banana' }
      ]
      expect(arrays.countBy(arr, item => item.type)).toEqual({
        fruit: 2,
        vegetable: 1
      })
    })

    it('returns an empty object for an empty array', () => {
      expect(arrays.countBy([], item => item)).toEqual({})
    })

    it('handles mixed types in the array', () => {
      expect(arrays.countBy([1, '1', true, 'true'], x => typeof x)).toEqual({
        number: 1,
        string: 2,
        boolean: 1
      })
    })

    it('counts with a function that returns a complex key', () => {
      expect(
        arrays.countBy([1.2, 1.3, 1.2, 2.3, 2.3], x => Math.floor(x))
      ).toEqual({ '1': 3, '2': 2 })
    })

    it('treats undefined and null distinctly', () => {
      expect(
        arrays.countBy([undefined, null, undefined, null], x => x)
      ).toEqual({ undefined: 2, null: 2 })
    })
  })

  describe('sum', () => {
    const arrays = new ArraysClass()

    it('calculates the sum of an array of numbers', () => {
      expect(arrays.sum([1, 2, 3, 4])).toBe(10)
    })

    it('returns 0 for an empty array', () => {
      expect(arrays.sum([])).toBe(0)
    })

    it('handles an array with a single number', () => {
      expect(arrays.sum([5])).toBe(5)
    })

    it('includes negative numbers in the sum', () => {
      expect(arrays.sum([-1, -2, -3, 4])).toBe(-2)
    })

    it('sums up an array of decimal numbers', () => {
      expect(arrays.sum([1.5, 2.5, 3])).toBe(7)
    })

    it('handles large numbers', () => {
      expect(arrays.sum([1000000, 2000000, 3000000])).toBe(6000000)
    })
  })

  describe('sumBy', () => {
    const arrays = new ArraysClass()

    it('calculates the sum of a property in an array of objects', () => {
      const objects = [{ value: 1 }, { value: 2 }, { value: 3 }]
      expect(arrays.sumBy(objects, obj => obj.value)).toBe(6)
    })

    it('handles an array with a single object', () => {
      const objects = [{ value: 5 }]
      expect(arrays.sumBy(objects, obj => obj.value)).toBe(5)
    })

    it('includes negative numbers in the sum', () => {
      const objects = [{ value: -1 }, { value: -2 }, { value: 3 }]
      expect(arrays.sumBy(objects, obj => obj.value)).toBe(0)
    })

    it('sums up an array of decimal numbers', () => {
      const objects = [{ value: 1.5 }, { value: 2.5 }, { value: 3 }]
      expect(arrays.sumBy(objects, obj => obj.value)).toBe(7)
    })

    it('returns 0 for an empty array', () => {
      const emptyArray: { value?: number }[] = []
      expect(arrays.sumBy(emptyArray, obj => obj.value)).toBe(0)
    })

    it('allows for complex calculations within the mapper function', () => {
      const objects = [{ value: 10 }, { value: 20 }, { value: 30 }]
      expect(arrays.sumBy(objects, obj => obj.value * 2)).toBe(120)
    })

    it('handles non-numeric return values from the mapper by ignoring them', () => {
      const mixedArray = [{ value: 1 }, { value: 'two' }, { value: 3 }]
      expect(
        arrays.sumBy(mixedArray, obj =>
          typeof obj.value === 'number' ? obj.value : 0
        )
      ).toBe(4)
    })
  })

  describe('mapToObject', () => {
    const arrays = new ArraysClass()

    it('converts an array of objects to an object with specified keys and values', () => {
      const objects = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' }
      ]
      expect(
        arrays.mapToObject(objects, item => [item.id, item.value])
      ).toEqual({ '1': 'a', '2': 'b' })
    })

    it('handles an array with a single object', () => {
      const objects = [{ id: 1, value: 'a' }]
      expect(
        arrays.mapToObject(objects, item => [item.id, item.value])
      ).toEqual({ '1': 'a' })
    })

    it('returns an empty object for an empty array', () => {
      const emptyArray: { id: string; value: string }[] = []
      expect(
        arrays.mapToObject(emptyArray, item => [item.id, item.value])
      ).toEqual({})
    })

    it('ignores items where the mapper function returns null or undefined', () => {
      const objects = [
        { id: 1, value: 'a' },
        { id: 2, value: null }
      ]
      expect(
        arrays.mapToObject(objects, item =>
          item.value ? [item.id, item.value] : null
        )
      ).toEqual({ '1': 'a' })
    })

    it('allows for complex key-value generation', () => {
      const objects = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' }
      ]
      expect(
        arrays.mapToObject(objects, item => [
          `${item.id}_key`,
          item.value.toUpperCase()
        ])
      ).toEqual({ '1_key': 'A', '2_key': 'B' })
    })

    it('handles cases where keys are duplicated, overwriting previous values', () => {
      const objects = [
        { id: 1, value: 'a' },
        { id: 1, value: 'b' }
      ]
      expect(
        arrays.mapToObject(objects, item => [item.id, item.value])
      ).toEqual({ '1': 'b' })
    })
  })

  describe('shuffle', () => {
    const arrays = new ArraysClass()

    it('returns an array with the same elements in a different order', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = arrays.shuffle(original)
      expect(shuffled).toEqual(expect.arrayContaining(original))
      expect(shuffled).not.toEqual(original)
    })

    it('does not mutate the original array by default', () => {
      const original = [1, 2, 3, 4, 5]
      const copy = [...original]
      arrays.shuffle(original)
      expect(original).toEqual(copy)
    })

    it('mutates the original array when mutate is true', () => {
      const original = [1, 2, 3, 4, 5]
      arrays.shuffle(original, true)
      expect(original).not.toEqual([1, 2, 3, 4, 5])
    })

    it('preserves the length of the array', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = arrays.shuffle(original)
      expect(shuffled.length).toBe(original.length)
    })

    it('preserves all original elements', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = arrays.shuffle(original)
      original.forEach(element => {
        expect(shuffled).toContain(element)
      })
    })
  })

  describe('flattenDeep', () => {
    const arrays = new ArraysClass()

    it('flattens a deeply nested array', () => {
      const nestedArray = [1, [2, [3, [4, 5]]], 6]
      expect(arrays.flattenDeep(nestedArray)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('flattens an array with various levels of nesting', () => {
      const nestedArray = [1, [2, 3], [[4], [5, [6]]]]
      expect(arrays.flattenDeep(nestedArray)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('returns an empty array when the input is an empty array', () => {
      expect(arrays.flattenDeep([])).toEqual([])
    })

    it('handles arrays with non-array elements', () => {
      const mixedArray = [1, [2, 'three', [true, [4, 5]]], 'six']
      expect(arrays.flattenDeep(mixedArray)).toEqual([
        1,
        2,
        'three',
        true,
        4,
        5,
        'six'
      ])
    })

    it('does not modify the original array', () => {
      const original = [1, [2, [3, [4, 5]]], 6]
      arrays.flattenDeep(original)
      expect(original).toEqual([1, [2, [3, [4, 5]]], 6])
    })

    it('flattens arrays containing null and undefined values', () => {
      const nestedArray = [1, [null, [undefined, [2, 3]]], 4]
      expect(arrays.flattenDeep(nestedArray)).toEqual([
        1,
        null,
        undefined,
        2,
        3,
        4
      ])
    })
  })

  describe('zip', () => {
    const arrays = new ArraysClass()

    it('combines elements from arrays of the same length', () => {
      expect(arrays.zip([1, 2, 3], ['a', 'b', 'c'])).toEqual([
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ])
    })

    it('handles arrays of different lengths by filling with undefined', () => {
      expect(arrays.zip([1, 2], ['a', 'b', 'c'])).toEqual([
        [1, 'a'],
        [2, 'b'],
        [undefined, 'c']
      ])
    })

    it('returns an empty array when no arrays are provided', () => {
      expect(arrays.zip()).toEqual([])
    })

    it('zips with arrays containing various types, including null and undefined', () => {
      expect(
        arrays.zip([1, null, 3], ['a', 'b', undefined], [true, false, true])
      ).toEqual([
        [1, 'a', true],
        [null, 'b', false],
        [3, undefined, true]
      ])
    })

    it('handles a single array by wrapping each element in an array', () => {
      expect(arrays.zip([1, 2, 3])).toEqual([[1], [2], [3]])
    })

    it('zips more than two arrays', () => {
      expect(arrays.zip([1, 2], ['a', 'b'], [true, false])).toEqual([
        [1, 'a', true],
        [2, 'b', false]
      ])
    })
  })

  describe('partition method', () => {
    it('should partition an empty array', () => {
      const array: number[] = []
      const [pass, fail] = Arrays.partition(array, () => true)
      expect(pass).toEqual([])
      expect(fail).toEqual([])
    })

    it('should partition using a predicate that always returns true', () => {
      const array = [1, 2, 3, 4, 5]
      const [pass, fail] = Arrays.partition(array, () => true)
      expect(pass).toEqual(array)
      expect(fail).toEqual([])
    })

    it('should partition using a predicate that always returns false', () => {
      const array = [1, 2, 3, 4, 5]
      const [pass, fail] = Arrays.partition(array, () => false)
      expect(pass).toEqual([])
      expect(fail).toEqual(array)
    })

    it('should partition using a mixed predicate', () => {
      const array = [1, 2, 3, 4, 5]
      const [pass, fail] = Arrays.partition(array, num => num % 2 === 0)
      expect(pass).toEqual([2, 4])
      expect(fail).toEqual([1, 3, 5])
    })

    it('should handle arrays with one element', () => {
      const array = [42]
      const [pass, fail] = Arrays.partition(array, () => true)
      expect(pass).toEqual(array)
      expect(fail).toEqual([])
    })

    it('should handle arrays with large numbers of elements', () => {
      const array = Array.from({ length: 1000 }, (_, i) => i)
      const [pass, fail] = Arrays.partition(array, num => num % 2 === 0)
      expect(pass).toEqual(array.filter(num => num % 2 === 0))
      expect(fail).toEqual(array.filter(num => num % 2 !== 0))
    })

    it('should handle arrays containing different data types', () => {
      const array: (string | number | boolean)[] = ['a', 1, true, 'b', 2, false]
      const [pass, fail] = Arrays.partition(
        array,
        elem => typeof elem === 'string'
      )
      expect(pass).toEqual(['a', 'b'])
      expect(fail).toEqual([1, true, 2, false])
    })

    it('should handle upper and lower boundary elements', () => {
      const array = [Number.MIN_VALUE, 0, Number.MAX_VALUE]
      const [pass, fail] = Arrays.partition(array, num => num > 0)
      // Since Number.MIN_VALUE is the smallest positive non-zero value, it should be in the pass array
      expect(pass).toContain(Number.MIN_VALUE)
      expect(pass).toContain(Number.MAX_VALUE)
      expect(fail).toContain(0)
    })

    it('should handle invalid input types', () => {
      // @ts-expect-error: Pass invalid type to trigger error handling
      expect(() => Arrays.partition(42, () => true)).toThrow()
    })

    it('should handle invalid predicate function', () => {
      const array = [1, 2, 3, 4, 5]
      // @ts-expect-error: Pass invalid predicate function to trigger error handling
      expect(() => Arrays.partition(array, 'invalid_predicate')).toThrow()
    })
  })

  describe('uniqueBy method', () => {
    it('should return an empty array when input array is empty', () => {
      const array: number[] = []
      const result = Arrays.uniqueBy(array, element => element)
      expect(result).toEqual([])
    })

    it('should return array with unique elements when input array contains duplicates', () => {
      const array = [1, 2, 2, 3, 3, 3, 4, 5, 5, 5, 5]
      const result = Arrays.uniqueBy(array, element => element)
      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should return array with unique elements when input array contains unique elements', () => {
      const array = [1, 2, 3, 4, 5]
      const result = Arrays.uniqueBy(array, element => element)
      expect(result).toEqual(array)
    })

    it('should handle array with elements of different data types', () => {
      const array: (string | number | boolean)[] = ['a', 1, true, 'b', 2, false]
      const result = Arrays.uniqueBy(array, element => element)
      expect(result).toEqual(['a', 1, true, 'b', 2, false])
    })

    it('should handle mapper function returning non-primitive values', () => {
      const array = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 1, value: 'c' }
      ]
      const result = Arrays.uniqueBy(array, element => element.id)
      expect(result).toEqual([
        { id: 1, value: 'a' },
        { id: 2, value: 'b' }
      ])
    })

    it('should handle large arrays efficiently', () => {
      const array = Array.from({ length: 10000 }, (_, i) => i % 10) // Array with 10 unique elements repeated 1000 times
      const result = Arrays.uniqueBy(array, element => element)
      expect(result.length).toEqual(10)
    })
  })

  describe('intersection method', () => {
    it('should return an empty array when input arrays are empty', () => {
      const result = Arrays.intersection()
      expect(result).toEqual([])
    })

    it('should return intersection of arrays when arrays intersect', () => {
      const array1 = [1, 2, 3, 4, 5]
      const array2 = [4, 5, 6, 7, 8]
      const result = Arrays.intersection(array1, array2)
      expect(result).toEqual([4, 5])
    })

    it('should return an empty array when arrays do not intersect', () => {
      const array1 = [1, 2, 3]
      const array2 = [4, 5, 6]
      const result = Arrays.intersection(array1, array2)
      expect(result).toEqual([])
    })

    it('should handle arrays with duplicate elements', () => {
      const array1 = [1, 2, 2, 3, 4]
      const array2 = [2, 3, 3, 4, 5]
      const result = Arrays.intersection(array1, array2)
      const expected = [2, 3, 4] // Expected intersection elements
      expect(result).toEqual(expected)
    })

    it('should handle arrays with elements of different data types', () => {
      const array1: (string | number)[] = [1, '2', 3, '4']
      const array2: (string | number)[] = ['2', 3, '4', 5]
      const result = Arrays.intersection(array1, array2)
      expect(result).toEqual(['2', 3, '4'])
    })

    it('should handle large arrays efficiently', () => {
      const array1 = Array.from({ length: 10000 }, (_, i) => i)
      const array2 = Array.from({ length: 10000 }, (_, i) => i % 1000)
      const result = Arrays.intersection(array1, array2)
      const expected = Array.from({ length: 1000 }, (_, i) => i) // Expected intersection elements
      expect(result).toEqual(expected)
    })
  })

  describe('difference method', () => {
    it('should return an empty array when first array is empty', () => {
      const array1: number[] = []
      const array2 = [1, 2, 3]
      const result = Arrays.difference(array1, array2)
      expect(result).toEqual([])
    })

    it('should return elements unique to the first array', () => {
      const array1 = [1, 2, 3, 4, 5]
      const array2 = [4, 5, 6, 7, 8]
      const result = Arrays.difference(array1, array2)
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle arrays with elements that intersect with the first array', () => {
      const array1 = [1, 2, 3, 4, 5]
      const array2 = [4, 5, 6, 7, 8]
      const result = Arrays.difference(array2, array1)
      expect(result).toEqual([6, 7, 8])
    })

    it('should handle arrays with duplicate elements', () => {
      const array1 = [1, 2, 2, 3, 4]
      const array2 = [2, 3, 3, 4, 5]
      const result = Arrays.difference(array1, array2)
      expect(result).toEqual([1])
    })

    it('should handle arrays with elements of different data types', () => {
      const array1: (string | number)[] = [1, '2', 3, '4']
      const array2: (string | number)[] = ['2', 3, '4', 5]
      const result = Arrays.difference(array1, array2)
      expect(result).toEqual([1])
    })

    it('should handle large arrays efficiently', () => {
      const array1 = Array.from({ length: 10000 }, (_, i) => i)
      const array2 = Array.from({ length: 10000 }, (_, i) => i % 1000)
      const result = Arrays.difference(array1, array2)
      expect(result.length).toBeGreaterThanOrEqual(9000) // Expect at least 9000 elements remaining
    })
  })

  describe('compact method', () => {
    it('should remove falsy values from the array', () => {
      const array = [0, false, '', null, undefined, NaN]
      const result = Arrays.compact(array)
      expect(result).toEqual([])
    })

    it('should not remove truthy values from the array', () => {
      const array = [1, true, 'a', {}, []]
      const result = Arrays.compact(array)
      expect(result).toEqual(array)
    })

    it('should return an empty array when input array is empty', () => {
      const array: number[] = []
      const result = Arrays.compact(array)
      expect(result).toEqual([])
    })

    it('should remove falsy values and keep truthy values in the array', () => {
      const array = [0, false, '', null, undefined, NaN, 1, true, 'a', {}, []]
      const result = Arrays.compact(array)
      expect(result).toEqual([1, true, 'a', {}, []])
    })

    it('should remove falsy values including null and undefined from the array', () => {
      const array = [null, undefined, 0, false, '', NaN]
      const result = Arrays.compact(array)
      expect(result).toEqual([])
    })

    it('should remove falsy values including empty strings and zero from the array', () => {
      const array = ['', 0, null, undefined, NaN]
      const result = Arrays.compact(array)
      expect(result).toEqual([])
    })

    it('should handle large arrays efficiently', () => {
      const array = Array.from({ length: 10000 }, (_, i) =>
        i % 2 === 0 ? '' : i
      ) // Every even index is falsy
      const result = Arrays.compact(array)
      expect(result.length).toBe(5000) // Expect 5000 truthy elements remaining
    })
  })

  describe('concatAll method', () => {
    it('should return an empty array when input arrays are empty', () => {
      const result = Arrays.concatAll()
      expect(result).toEqual([])
    })

    it('should concatenate arrays containing elements of different types', () => {
      const array1 = [1, 2, 3]
      const array2 = ['a', 'b', 'c']
      const array3 = [{}, []]
      const result = Arrays.concatAll(array1, array2, array3)
      expect(result).toEqual([...array1, ...array2, ...array3])
    })

    it('should concatenate arrays containing primitive values', () => {
      const array1 = [1, 2, 3]
      const array2 = [4, 5, 6]
      const result = Arrays.concatAll(array1, array2)
      expect(result).toEqual([...array1, ...array2])
    })

    it('should concatenate arrays containing objects', () => {
      const obj1 = { id: 1, name: 'John' }
      const obj2 = { id: 2, name: 'Doe' }
      const array1 = [obj1]
      const array2 = [obj2]
      const result = Arrays.concatAll(array1, array2)
      expect(result).toEqual([...array1, ...array2])
    })

    it('should concatenate a mix of empty and non-empty arrays', () => {
      const array1: number[] = []
      const array2 = [1, 2, 3]
      const array3: number[] = [] // Change the type to number[]
      const result = Arrays.concatAll(array1, array2, array3)
      expect(result).toEqual([...array1, ...array2, ...array3])
    })

    it('should handle large arrays efficiently', () => {
      const arrays = Array.from({ length: 1000 }, (_, i) =>
        Array.from({ length: 1000 }, (_, j) => i * 1000 + j)
      )
      const result = Arrays.concatAll(...arrays)
      expect(result.length).toBe(1000000) // Expect 1,000,000 elements in total
    })
  })

  describe('isEmpty method', () => {
    it('should return true for an empty array', () => {
      const array: number[] = []
      const result = Arrays.isEmpty(array)
      expect(result).toBe(true)
    })

    it('should return false for a non-empty array containing primitive values', () => {
      const array = [1, 2, 3]
      const result = Arrays.isEmpty(array)
      expect(result).toBe(false)
    })

    it('should return false for a non-empty array containing objects', () => {
      const array = [{ id: 1 }, { id: 2 }]
      const result = Arrays.isEmpty(array)
      expect(result).toBe(false)
    })

    it('should return false for an array containing falsy values', () => {
      const array = [0, false, '', null, undefined, NaN]
      const result = Arrays.isEmpty(array)
      expect(result).toBe(false)
    })

    it('should return true for an array containing only truthy values', () => {
      const array = [1, true, 'hello']
      const result = Arrays.isEmpty(array)
      expect(result).toBe(false)
    })

    it('should handle large arrays efficiently', () => {
      const array = Array.from({ length: 10000 }, (_, i) => i)
      const result = Arrays.isEmpty(array)
      expect(result).toBe(false)
    })
  })
})
