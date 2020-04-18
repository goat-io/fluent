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
  it('It should remove null values recursively from an Object', () => {
    let object = {
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

    let test = Objects.deleteNulls(object)
    let expected = {
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
