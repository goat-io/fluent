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
