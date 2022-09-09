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
