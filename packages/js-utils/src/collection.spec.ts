// yarn test collection.spec.ts

import { Collection } from './Collection'

interface Goat {
  name: string
  age: number
  breed?: {
    family: string
    members: number
  }
}

const goats = [
  { name: 'Johnny', age: 20, breed: { family: 'The Goat`s', members: 60 } },
  { name: 'Michael', age: 40, breed: { family: 'The Goatee`s', members: 30 } }
]

const Goats = Collection.collect<Goat>(goats)

it('All - Should return the original array', () => {
  expect(Goats.all()[0].name).toBe('Johnny')
})

it('Get - Should return the original array', () => {
  expect(Goats.get()[0].name).toBe('Johnny')
})

it('Avg - Should return the average', () => {
  expect(Goats.avg(k => k.age)).toBe(30)
  expect(Goats.avg(k => k.breed.members)).toBe(45)
})

it('Average - Should also run for none Objects Arrays', () => {
  expect(Collection.collect([1, 1, 2, 4]).average()).toBe(2)
})

it('Chunk - Should devide in smaller arrays', () => {
  const chunks = Collection.collect([1, 2, 3, 4, 5, 6, 7]).chunk(4).get()
  expect(chunks.length).toBe(2)
  expect(chunks[0].length).toBe(4)
  expect(chunks[1].length).toBe(3)

  const goatChunks = Goats.chunk(1).get()
  expect(goatChunks.length).toBe(2)
  expect(goatChunks[0].length).toBe(1)
  expect(goatChunks[1].length).toBe(1)
})

it('Collapse - Should deChunk a chunked array', () => {
  const collapsed = Collection.collect([
    [1, 2, 3, 4],
    [5, 6, 7]
  ])
    .collapse()
    .get()
  expect(collapsed.length).toBe(7)
})

it('Concat - Should return both arrays', () => {
  const concatenated = Goats.concat([
    {
      name: 'Michael Jr',
      age: 40,
      breed: { family: 'The Goatee`s', members: 30 }
    }
  ]).get()

  expect(concatenated[2].name).toBe('Michael Jr')
})

it('Contains - Should verify presence of', () => {
  expect(Goats.contains({ value: 'Johnny', path: k => k.name })).toBe(true)
  expect(Goats.contains({ value: 'Johnny 2', path: k => k.name })).toBe(false)
  expect(
    Goats.contains({ value: 'The Goatee`s', path: k => k.breed.family })
  ).toBe(true)

  expect(
    Goats.contains({
      Fx: goat => goat.age === 30
    })
  ).toBe(false)

  expect(Collection.collect([1, 10, 11]).contains({ value: 12 })).toBe(false)
  expect(Collection.collect([1, 10, 11]).contains({ value: 10 })).toBe(true)

  expect(Collection.collect(['A', 'B', 'C']).contains({ value: 'C' })).toBe(
    true
  )
  expect(Collection.collect(['A', 'B', 'C']).contains({ value: 'E' })).toBe(
    false
  )

  expect(
    Collection.collect(['A', 'B', 'C']).contains({
      Fx: element => element === 'D'
    })
  ).toBe(false)

  expect(
    Collection.collect(['A', 'B', 'C']).contains({
      Fx: element => element === 'A'
    })
  ).toBe(true)
})

it('Count - Should return the number of elements', () => {
  expect(Collection.collect([1, 4, 6]).count()).toBe(3)
})

describe('Combine', () => {
  it('should combine keys from the collection with values from the array', () => {
    const keys = [1, 'name'] // Mixed types
    const values = ['George', 29]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ '1': 'George', name: 29 }])
  })

  it('should handle null values correctly', () => {
    const keys = ['name', 'age']
    const values = [null, null]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ name: null, age: null }])
  })

  it('should handle undefined values correctly', () => {
    const keys = ['name', 'age']
    const values = [undefined, undefined]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ name: undefined, age: undefined }])
  })

  // Test 3: Combining with boolean values
  it('should handle boolean values correctly', () => {
    const keys = ['isActive', 'isVerified']
    const values = [true, false]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ isActive: true, isVerified: false }])
  })

  // Test 4: Combining with numeric keys
  it('should handle numeric keys correctly', () => {
    const keys = [1, 2]
    const values = ['one', 'two']

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ '1': 'one', '2': 'two' }])
  })

  // Test 5: Combining with mixed types of keys
  it('should handle mixed types of keys correctly', () => {
    const keys = ['name', 1]
    const values = ['John', 'one']

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ name: 'John', '1': 'one' }])
  })

  // Test 6: Combining with objects as values
  it('should handle objects as values correctly', () => {
    const keys = ['user1', 'user2']
    const values = [{ name: 'John' }, { name: 'Jane' }]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([
      { user1: { name: 'John' }, user2: { name: 'Jane' } }
    ])
  })

  // Test 7: Combining with arrays as values
  it('should handle arrays as values correctly', () => {
    const keys = ['numbers', 'letters']
    const values = [
      [1, 2, 3],
      ['a', 'b', 'c']
    ]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([
      { numbers: [1, 2, 3], letters: ['a', 'b', 'c'] }
    ])
  })

  // Test 8: Combining with zero as values
  it('should handle zero as values correctly', () => {
    const keys = ['count1', 'count2']
    const values = [0, 0]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([{ count1: 0, count2: 0 }])
  })

  // Test 9: Combining with a complex mix of types
  it('should handle a complex mix of types correctly', () => {
    const keys = ['string', 'null', 'undefined', 'boolean', 'number']
    const values = ['text', null, undefined, true, 42]

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    expect(combined.get()).toEqual([
      {
        string: 'text',
        null: null,
        undefined: undefined,
        boolean: true,
        number: 42
      }
    ])
  })

  // Test 10: Combining with duplicate keys
  it('should override previous values when keys are duplicated', () => {
    const keys = ['dup', 'dup']
    const values = ['first', 'second']

    const collection = new Collection(keys)
    const combined = collection.combine(values)

    // The second value should override the first one
    expect(combined.get()).toEqual([{ dup: 'second' }])
  })
})

describe('Collection.concat', () => {
  it('should concatenate array values onto the collection', () => {
    const collection = new Collection(['John Doe'])
    const concatenated = collection.concat(['Jane Doe']).concat(['Johnny Doe'])

    expect(concatenated.get()).toEqual(['John Doe', 'Jane Doe', 'Johnny Doe'])
  })

  it('should handle concatenating empty arrays', () => {
    const collection = new Collection(['John Doe'])
    const concatenated = collection.concat([])

    expect(concatenated.get()).toEqual(['John Doe'])
  })

  it('should handle concatenating multiple types', () => {
    const collection = new Collection([1, 'two'])
    const concatenated = collection.concat([true, { three: 3 }])

    expect(concatenated.get()).toEqual([1, 'two', true, { three: 3 }])
  })

  it('should concatenate Collection instances', () => {
    const collection = new Collection(['John Doe'])
    const anotherCollection = new Collection(['Jane Doe'])
    const concatenated = collection.concat(anotherCollection)

    expect(concatenated.get()).toEqual(['John Doe', 'Jane Doe'])
  })

  it('should not mutate the original collection', () => {
    const collection = new Collection(['John Doe'])
    const concatenated = collection.concat(['Jane Doe'])

    expect(collection.get()).toEqual(['John Doe'])
    expect(concatenated.get()).toEqual(['John Doe', 'Jane Doe'])
  })

  it('should concatenate nested arrays', () => {
    const collection = new Collection([[1, 2]])
    const concatenated = collection.concat([[3, 4]])

    expect(concatenated.get()).toEqual([
      [1, 2],
      [3, 4]
    ])
  })

  it('should handle null values', () => {
    const collection = new Collection([null])
    const concatenated = collection.concat([null])

    expect(concatenated.get()).toEqual([null, null])
  })

  it('should handle undefined values', () => {
    const collection = new Collection([undefined])
    const concatenated = collection.concat([undefined])

    expect(concatenated.get()).toEqual([undefined, undefined])
  })

  it('should handle concatenating complex objects', () => {
    const collection = new Collection([{ name: 'John Doe' }])
    const concatenated = collection.concat([{ name: 'Jane Doe' }])

    expect(concatenated.get()).toEqual([
      { name: 'John Doe' },
      { name: 'Jane Doe' }
    ])
  })

  it('should concatenate collections with mixed value types', () => {
    const collection = new Collection(['John Doe', 42])
    const concatenated = collection.concat([true, { name: 'Jane Doe' }])

    expect(concatenated.get()).toEqual([
      'John Doe',
      42,
      true,
      { name: 'Jane Doe' }
    ])
  })
})

describe('Collection.countBy', () => {
  it('should count occurrences of each element', () => {
    const collection = new Collection([1, 2, 2, 2, 3])
    const counted = collection.countBy()
    expect(counted.get()).toEqual([{ 1: 1, 2: 3, 3: 1 }])
  })

  it('should count elements by a callback', () => {
    const collection = new Collection([
      'alice@gmail.com',
      'bob@yahoo.com',
      'carlos@gmail.com'
    ])
    const counted = collection.countBy(email => email.split('@')[1])
    expect(counted.get()).toEqual([{ 'gmail.com': 2, 'yahoo.com': 1 }])
  })

  it('should handle an array of objects', () => {
    const collection = new Collection([
      { type: 'apple' },
      { type: 'orange' },
      { type: 'apple' }
    ])
    const counted = collection.countBy(item => item.type)
    expect(counted.get()).toEqual([{ apple: 2, orange: 1 }])
  })

  it('should handle mixed types', () => {
    const collection = new Collection([1, '1', 2, '2', '2'])
    const counted = collection.countBy()
    expect(counted.get()).toEqual([{ '1': 2, '2': 3 }])
  })
})

describe('Collection.crossJoin', () => {
  it('creates a Cartesian product of the collection with one array', () => {
    const collection = new Collection([1, 2])
    const matrix = collection.crossJoin(['a', 'b'])

    expect(matrix.get()).toEqual([
      [1, 'a'],
      [1, 'b'],
      [2, 'a'],
      [2, 'b']
    ])
  })

  it('creates a Cartesian product of the collection with multiple arrays', () => {
    const collection = new Collection([1, 2])
    const matrix = collection.crossJoin(['a', 'b'], ['I', 'II'])

    expect(matrix.get()).toEqual([
      [1, 'a', 'I'],
      [1, 'a', 'II'],
      [1, 'b', 'I'],
      [1, 'b', 'II'],
      [2, 'a', 'I'],
      [2, 'a', 'II'],
      [2, 'b', 'I'],
      [2, 'b', 'II']
    ])
  })

  it('handles an empty collection or array', () => {
    const collection = new Collection([])
    const matrix = collection.crossJoin(['a', 'b'])

    expect(matrix.get()).toEqual([])
  })

  // Add more tests as needed...
})

describe('Collection.diff', () => {
  it('returns the values in the collection that are not present in the given array', () => {
    const collection = new Collection([1, 2, 3, 4, 5])
    const diff = collection.diff([2, 4, 6, 8])
    expect(diff.get()).toEqual([1, 3, 5])
  })

  it('returns the values in the collection that are not present in the given collection', () => {
    const collection = new Collection([1, 2, 3, 4, 5])
    const otherCollection = new Collection([2, 4, 6, 8])
    const diff = collection.diff(otherCollection)
    expect(diff.get()).toEqual([1, 3, 5])
  })

  it('can handle an array of objects', () => {
    const collection = new Collection([{ id: 1 }, { id: 2 }, { id: 3 }])
    const diff = collection.diff([{ id: 2 }, { id: 4 }])
    expect(diff.get()).toEqual([{ id: 1 }, { id: 3 }])
  })

  // Add more tests as needed...
})

// describe('Collection.dot', () => {
//   it('flattens a simple object', () => {
//     const collection = new Collection([{ key1: 'value1', key2: 'value2' }])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ key1: 'value1', key2: 'value2' }])
//   })

//   it('flattens nested objects', () => {
//     const collection = new Collection([{ parent: { child: 'value' } }])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ 'parent.child': 'value' }])
//   })

//   it('handles multiple nested objects', () => {
//     const collection = new Collection([
//       { parent1: { child1: 'value1' }, parent2: { child2: 'value2' } }
//     ])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([
//       { 'parent1.child1': 'value1', 'parent2.child2': 'value2' }
//     ])
//   })

//   it('flattens objects with array values', () => {
//     const collection = new Collection([{ parent: { children: [1, 2, 3] } }])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ 'parent.children': [1, 2, 3] }])
//   })

//   it('handles nested objects within arrays', () => {
//     const collection = new Collection([
//       { parent: ['child', { grandchild: 'value' }] }
//     ])
//     const flattened = collection.dot()
//     // Note: Arrays are not flattened; they remain intact
//     expect(flattened.get()).toEqual([
//       { 'parent.0': 'child', 'parent.1.grandchild': 'value' }
//     ])
//   })

//   it('flattens deeply nested structures', () => {
//     const collection = new Collection([
//       { level1: { level2: { level3: 'value' } } }
//     ])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ 'level1.level2.level3': 'value' }])
//   })

//   it('handles an empty collection', () => {
//     const collection = new Collection([{}])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{}])
//   })

//   it('preserves integers and booleans', () => {
//     const collection = new Collection([{ int: 1, bool: false }])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ int: 1, bool: false }])
//   })

//   it('flattens collections with multiple items', () => {
//     const collection = new Collection([
//       { item1: 'value1' },
//       { item2: 'value2' }
//     ])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([{ item1: 'value1' }, { item2: 'value2' }])
//   })

//   it('handles null and undefined values', () => {
//     const collection = new Collection([
//       { nullKey: null, undefinedKey: undefined }
//     ])
//     const flattened = collection.dot()
//     expect(flattened.get()).toEqual([
//       { nullKey: null, undefinedKey: undefined }
//     ])
//   })

//   // Add more tests as needed...
// })
