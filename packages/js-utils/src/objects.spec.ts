import { Objects } from './Objects'

const nestedObject: any = { a: { b: { c: 'hello' } } }

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
    expect(Objects.isPlainObject(null)).toBe(false)
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
