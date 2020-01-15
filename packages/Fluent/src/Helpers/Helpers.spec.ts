import { Objects } from './Objects'

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

  let test = Objects().deleteNulls(object)
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
