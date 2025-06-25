// npx jest -i ./src/objects.spec.ts

import { Objects } from './Objects'

const nestedObject: any = { a: { b: { c: 'hello' } } }

describe('Objects', () => {
  describe('[get]', () => {
    it('Should return undefined if the value is not found', () => {
      const value = Objects.get(() => nestedObject.a.b.e)
      expect(value).toBe(undefined)
    })

    it('Should return default if the value is not found', () => {
      const a = Objects.get(() => nestedObject.a.b.e, 'bye!!')
      expect(a).toBe('bye!!')
    })

    it('Should return the value', () => {
      const value = Objects.get(() => nestedObject.a.b.c)
      expect(value).toBe('hello')
    })
  })

  describe('[deleteNulls]', () => {
    it('should remove null values recursively from an Object', () => {
      const object = {
        property: 'val1',
        property1: null,
        nested: {
          property: 'val1',
          property1: null,
          nested: {
            property: 'val1',
            property1: null,
            nested: {
              property: 'val1',
              property1: null
            }
          }
        }
      }

      const test = Objects.deleteNulls(object)
      const expected = {
        property: 'val1',
        nested: {
          property: 'val1',
          nested: {
            property: 'val1',
            nested: {
              property: 'val1'
            }
          }
        }
      }

      expect(JSON.stringify(test)).toBe(JSON.stringify(expected))
    })
  })

  describe('[sortObjectDeep]', () => {
    const initial = {
      d: '1',
      a: '2',
      b: '3'
    }

    const val = Objects.sortObjectDeep(initial)
  })

  describe('[flatten and nest]', () => {
    it('should flatten a nested object correctly', () => {
      const input = { a: { b: { c: 'hello' } } }
      const result = Objects.flatten(input)
      expect(result).toEqual({ 'a.b.c': 'hello' })
    })

    it('should nest a flat object correctly', () => {
      const input = { 'a.b.c': 'hello' }
      const result = Objects.nest(input)
      expect(result).toEqual({ a: { b: { c: 'hello' } } })
    })
  })

  describe('[isEmpty]', () => {
    it('should detect empty objects and arrays', () => {
      expect(Objects.isEmpty([])).toBe(true)
      expect(Objects.isEmpty({})).toBe(true)
      expect(Objects.isEmpty('')).toBe(true)
      expect(Objects.isEmpty(null)).toBe(true)
      expect(Objects.isEmpty(undefined)).toBe(true)
      expect(Objects.isEmpty([1])).toBe(false)
      expect(Objects.isEmpty({ a: 1 })).toBe(false)
    })
  })

  describe('[filterUndefinedValues]', () => {
    it('should remove undefined values', () => {
      const obj = { a: 1, b: undefined, c: null }
      const result = Objects.filterUndefinedValues(obj)
      expect(result).toEqual({ a: 1, c: null })
    })
  })

  describe('[mapValues]', () => {
    it('should map values correctly', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapValues(obj, (_k, v) => v * 2)
      expect(result).toEqual({ a: 2, b: 4 })
    })
  })

  describe('[omit]', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = Objects.omit(obj, ['b'] as const)
      expect(result).toEqual({ a: 1, c: 3 })
    })
  })

  describe('[pick]', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = Objects.pick(obj, ['b'] as const)
      expect(result).toEqual({ b: 2 })
    })
  })

  describe('[deepEquals]', () => {
    it('should detect deep equality', () => {
      const obj1 = { a: [1, 2], b: { c: 3 } }
      const obj2 = { a: [1, 2], b: { c: 3 } }
      const obj3 = { a: [1, 2], b: { c: 4 } }
      expect(Objects.deepEquals(obj1, obj2)).toBe(true)
      expect(Objects.deepEquals(obj1, obj3)).toBe(false)
    })
  })

  describe('[getFromPath]', () => {
    it('should retrieve value by string path', () => {
      const obj = { a: { b: { c: 'value' } } }
      const { value, label } = Objects.getFromPath(obj, 'a.b.c')
      expect(value).toBe('value')
      expect(label).toBe('a.b.c')
    })

    it('should return default if path is invalid', () => {
      const obj = { a: { b: { c: 'value' } } }
      const { value } = Objects.getFromPath(obj, 'a.b.x', 'default')
      expect(value).toBe('default')
    })

    it('should assign label from alias', () => {
      const obj = { a: { b: { c: 'value' } } }
      const result = Objects.getFromPath(obj, 'a.b.c as Alias')
      expect(result.label).toBe('Alias')
      expect(result.value).toBe('value')
    })
  })

  describe('[clearEmpties]', () => {
    it('should remove empty nested objects and arrays', () => {
      const obj = {
        keep: 'value',
        remove: null,
        nested: {
          clean: [],
          deeper: {
            alsoRemove: undefined
          }
        }
      }
      const result = Objects.clearEmpties(obj)
      expect(result).toEqual({ keep: 'value' })
    })
  })

  describe('[sort]', () => {
    it('should sort object keys according to given order', () => {
      const obj = { b: 2, a: 1, c: 3 }
      const result = Objects.sort(obj, ['a', 'b'])
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })
  })

  describe('[isPlainObject]', () => {
    it('should return true for plain objects', () => {
      expect(Objects.isPlainObject({ a: 1 })).toBe(true)
    })

    it('should return false for arrays and null', () => {
      expect(Objects.isPlainObject([])).toBe(false)
    })
  })

  describe('[mapKeys]', () => {
    it('should rename keys based on mapper', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapKeys(obj, k => `${k}-x`)
      expect(result).toEqual({ 'a-x': 1, 'b-x': 2 })
    })
  })

  describe('[mapObject]', () => {
    it('should map object to new key-value pairs', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapObject(obj, (k, v) => [`new-${k}`, v + 1])
      expect(result).toEqual({ 'new-a': 2, 'new-b': 3 })
    })
  })

  describe('[objectNullValuesToUndefined]', () => {
    it('should convert nulls to undefined', () => {
      const obj = { a: null, b: 1 }
      const result = Objects.objectNullValuesToUndefined(obj)
      expect(result).toEqual({ a: undefined, b: 1 })
    })
  })

  describe('[undefinedIfEmpty]', () => {
    it('should return undefined if input is empty', () => {
      expect(Objects.undefinedIfEmpty({})).toBeUndefined()
    })

    it('should return original object if not empty', () => {
      const obj = { a: 1 }
      expect(Objects.undefinedIfEmpty(obj)).toBe(obj)
    })
  })

  describe('[isEmptyObject]', () => {
    it('should return true for empty objects', () => {
      expect(Objects.isEmptyObject({})).toBe(true)
    })

    it('should return false for non-empty objects', () => {
      expect(Objects.isEmptyObject({ a: 1 })).toBe(false)
    })
  })

  describe('[findKeyByValue]', () => {
    it('should find key by value', () => {
      const obj = { a: 1, b: 2 }
      expect(Objects.findKeyByValue(obj, 2)).toBe('b')
    })

    it('should return undefined if not found', () => {
      const obj = { a: 1, b: 2 }
      expect(Objects.findKeyByValue(obj, 3)).toBeUndefined()
    })
  })

  describe('get', () => {
    it('should return value when function executes successfully', () => {
      const result = Objects.get(() => 'test value')
      expect(result).toBe('test value')
    })

    it('should return default value when function throws error', () => {
      const result = Objects.get(() => {
        throw new Error('test error')
      }, 'default')
      expect(result).toBe('default')
    })

    it('should return default value when function returns undefined', () => {
      const result = Objects.get(() => undefined, 'default')
      expect(result).toBe('default')
    })

    it('should return undefined when no default provided and function fails', () => {
      const result = Objects.get(() => {
        throw new Error('test error')
      })
      expect(result).toBeUndefined()
    })
  })

  describe('getFromPath', () => {
    const testObj = {
      user: {
        name: 'John',
        details: {
          age: 30,
          hobbies: ['reading', 'gaming']
        }
      },
      items: [{ id: 1, name: 'item1' }]
    }

    it('should get nested object value', () => {
      const result = Objects.getFromPath(testObj, 'user.name')
      expect(result).toEqual({ label: 'user.name', value: 'John' })
    })

    it('should get deeply nested value', () => {
      const result = Objects.getFromPath(testObj, 'user.details.age')
      expect(result).toEqual({ label: 'user.details.age', value: 30 })
    })

    it('should get array value with bracket notation', () => {
      const result = Objects.getFromPath(testObj, 'user.details.hobbies[0]')
      expect(result).toEqual({
        label: 'user.details.hobbies[0]',
        value: 'reading'
      })
    })

    it('should return default value for non-existent path', () => {
      const result = Objects.getFromPath(testObj, 'user.nonexistent', 'default')
      expect(result).toEqual({ label: 'user.nonexistent', value: 'default' })
    })

    it('should handle "as" alias syntax', () => {
      const result = Objects.getFromPath(testObj, 'user.name as userName')
      expect(result).toEqual({ label: 'userName', value: 'John' })
    })
  })

  describe('flatten', () => {
    it('should flatten nested object with dot notation', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3
          }
        }
      }
      const result = Objects.flatten(obj)
      expect(result).toEqual({
        a: '1',
        'b.c': '2',
        'b.d.e': '3'
      })
    })

    it('should include base keys when requested', () => {
      const obj = {
        a: {
          b: 1
        }
      }
      const result = Objects.flatten(obj, true)
      expect(result).toEqual({
        a: 'true',
        'a.b': '1'
      })
    })

    it('should use custom key factory', () => {
      const obj = {
        a: {
          b: 1
        }
      }
      const result = Objects.flatten(
        obj,
        false,
        (prev, curr) => `${prev}_${curr}`
      )
      expect(result).toEqual({
        a_b: '1'
      })
    })

    it('should handle arrays as values', () => {
      const obj = {
        a: [1, 2, 3],
        b: {
          c: ['x', 'y']
        }
      }
      const result = Objects.flatten(obj)
      expect(result).toEqual({
        a: '1,2,3',
        'b.c': 'x,y'
      })
    })

    it('should handle null values', () => {
      const obj = {
        a: null,
        b: {
          c: null
        }
      }
      const result = Objects.flatten(obj)
      expect(result).toEqual({
        a: 'null',
        'b.c': 'null'
      })
    })
  })

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(Objects.isPlainObject({})).toBe(true)
      expect(Objects.isPlainObject({ a: 1 })).toBe(true)
    })

    it('should return false for non-plain objects', () => {
      expect(Objects.isPlainObject([])).toBe(false)
      expect(Objects.isPlainObject(new Date())).toBe(false)
    })
  })

  describe('nest', () => {
    it('should convert flattened object back to nested', () => {
      const flattened = {
        a: '1',
        'b.c': '2',
        'b.d.e': '3'
      }
      const result = Objects.nest(flattened)
      expect(result).toEqual({
        a: '1',
        b: {
          c: '2',
          d: {
            e: '3'
          }
        }
      })
    })

    it('should handle empty object', () => {
      const result = Objects.nest({})
      expect(result).toEqual({})
    })

    it('should mark new objects when requested', () => {
      const flattened = {
        'a.b': '1'
      }
      const result = Objects.nest(flattened, true)
      expect(result['a']).toHaveProperty('isObject', true)
    })
  })

  describe('clone', () => {
    it('should deep clone object', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4]
        }
      }
      const cloned = Objects.clone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).not.toBe(obj.b)
    })

    it('should not clone functions', () => {
      const obj = {
        a: 1,
        fn: () => 'test'
      }
      const cloned = Objects.clone(obj)
      expect(cloned.fn).toBeUndefined()
    })
  })

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(Objects.isEmpty(undefined)).toBe(true)
      expect(Objects.isEmpty(null)).toBe(true)
      expect(Objects.isEmpty('')).toBe(true)
      expect(Objects.isEmpty([])).toBe(true)
      expect(Objects.isEmpty({})).toBe(true)
      expect(Objects.isEmpty(new Map())).toBe(true)
      expect(Objects.isEmpty(new Set())).toBe(true)
    })

    it('should return false for non-empty values', () => {
      expect(Objects.isEmpty('test')).toBe(false)
      expect(Objects.isEmpty([1])).toBe(false)
      expect(Objects.isEmpty({ a: 1 })).toBe(false)
      expect(Objects.isEmpty(new Map([['a', 1]]))).toBe(false)
      expect(Objects.isEmpty(new Set([1]))).toBe(false)
      expect(Objects.isEmpty(0)).toBe(false)
      expect(Objects.isEmpty(false)).toBe(false)
    })
  })

  describe('deleteNulls', () => {
    it('should remove null values from object', () => {
      const obj = {
        a: 1,
        b: null,
        c: {
          d: null,
          e: 2
        }
      }
      const result = Objects.deleteNulls(obj)
      expect(result).toEqual({
        a: 1,
        c: {
          e: 2
        }
      })
    })

    it('should remove null values from array', () => {
      const arr = [1, null, 2, null, 3]
      const result = Objects.deleteNulls(arr)
      expect(result).toEqual([1, 2, 3])
    })

    // it('should handle nested structures', () => {
    //   const obj = {
    //     a: [1, null, { b: null, c: 3 }]
    //   }
    //   const result = Objects.deleteNulls(obj)
    //   expect(result).toEqual({
    //     a: [1, { c: 3 }]
    //   })
    // })
  })

  describe('filterUndefinedValues', () => {
    it('should remove undefined values', () => {
      const obj = {
        a: 1,
        b: undefined,
        c: null,
        d: 'test'
      }
      const result = Objects.filterUndefinedValues(obj)
      expect(result).toEqual({
        a: 1,
        c: null,
        d: 'test'
      })
    })

    it('should mutate original object when mutate=true', () => {
      const obj = {
        a: 1,
        b: undefined
      }
      const result = Objects.filterUndefinedValues(obj, true)
      expect(result).toBe(obj)
      expect(obj).toEqual({ a: 1 })
    })
  })

  describe('filterObject', () => {
    it('should filter object by predicate', () => {
      const obj = {
        a: 1,
        b: 2,
        c: 3
      }
      const result = Objects.filterObject(obj, (k, v) => v > 1)
      expect(result).toEqual({
        b: 2,
        c: 3
      })
    })

    it('should provide key, value, and original object to predicate', () => {
      const obj = { a: 1, b: 2 }
      const predicate = jest.fn(() => true)
      Objects.filterObject(obj, predicate)

      expect(predicate).toHaveBeenCalledWith('a', 1, obj)
      expect(predicate).toHaveBeenCalledWith('b', 2, obj)
    })
  })

  describe('clearEmpties', () => {
    it('should remove empty and nullish values', () => {
      const obj = {
        a: 1,
        b: null,
        c: undefined,
        d: [],
        e: {},
        f: {
          g: null,
          h: 2
        }
      }
      const result = Objects.clearEmpties(obj)
      expect(result).toEqual({
        a: 1,
        f: {
          h: 2
        }
      })
    })

    it('should preserve Date objects', () => {
      const date = new Date()
      const obj = {
        a: date,
        b: null
      }
      const result = Objects.clearEmpties(obj)
      expect(result).toEqual({ a: date })
    })
  })

  describe('isAnyObject', () => {
    it('should return true for objects', () => {
      expect(Objects.isAnyObject({})).toBe(true)
      expect(Objects.isAnyObject({ a: 1 })).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(Objects.isAnyObject([])).toBe(false)
      expect(Objects.isAnyObject(null)).toBe(false)
      expect(Objects.isAnyObject('string')).toBe(false)
      expect(Objects.isAnyObject(123)).toBe(false)
    })
  })

  describe('mapValues', () => {
    it('should map object values', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = Objects.mapValues(obj, (k, v) => v * 2)
      expect(result).toEqual({ a: 2, b: 4, c: 6 })
    })

    it('should provide key, value, and original object to mapper', () => {
      const obj = { a: 1, b: 2 }
      const mapper = jest.fn((k, v) => v)
      Objects.mapValues(obj, mapper)

      expect(mapper).toHaveBeenCalledWith('a', 1, obj)
      expect(mapper).toHaveBeenCalledWith('b', 2, obj)
    })

    it('should mutate original object when mutate=true', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapValues(obj, (k, v) => v * 2, true)
      expect(result).toBe(obj)
      expect(obj).toEqual({ a: 2, b: 4 })
    })
  })

  describe('mapKeys', () => {
    it('should map object keys', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapKeys(obj, (k, v) => k.toUpperCase())
      expect(result).toEqual({ A: 1, B: 2 })
    })
  })

  describe('mapObject', () => {
    it('should map both keys and values', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.mapObject(obj, (k, v) => [k.toUpperCase(), v * 2])
      expect(result).toEqual({ A: 2, B: 4 })
    })
  })

  describe('findKeyByValue', () => {
    it('should find key by value', () => {
      const obj = { a: 1, b: 2, c: 1 }
      const result = Objects.findKeyByValue(obj, 2)
      expect(result).toBe('b')
    })

    it('should return first matching key', () => {
      const obj = { a: 1, b: 1, c: 2 }
      const result = Objects.findKeyByValue(obj, 1)
      expect(result).toBe('a')
    })

    it('should return undefined if value not found', () => {
      const obj = { a: 1, b: 2 }
      const result = Objects.findKeyByValue(obj, 3)
      expect(result).toBeUndefined()
    })
  })

  describe('objectNullValuesToUndefined', () => {
    it('should convert null values to undefined', () => {
      const obj = { a: 1, b: null, c: 'test' }
      const result = Objects.objectNullValuesToUndefined(obj)
      expect(result).toEqual({ a: 1, b: undefined, c: 'test' })
    })
  })
})
