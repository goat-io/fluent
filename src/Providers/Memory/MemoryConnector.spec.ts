import { Fluent } from '../../Fluent'
import { MemoryConnector } from './MemoryConnector'

interface IGoat {
  name: string
  age: number
  breed?: {
    family: string
    members: number
  }
}
let storedId: string = ''

const GoatModel = (() => {
  Fluent.model<IGoat>('GoatModel')

  const remote = () => {
    return new MemoryConnector<IGoat>()
  }

  const local = () => {
    return new MemoryConnector<IGoat>()
  }

  return Object.freeze({ remote, local })
})()

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.remote().get()
  expect(Array.isArray(storedGoats)).toBe(true)
  expect(storedGoats.length).toBe(0)
})

it('Create Single - Should insert Data', async () => {
  const inserted = await GoatModel.remote().insert({
    age: 29,
    name: 'Ignacio',
    breed: {
      members: 20,
      family: 'The Goats'
    }
  })

  const inserted2 = await GoatModel.remote().insert({
    age: 15,
    name: 'Andres'
  })

  expect(typeof inserted._id).toBe('string')
  expect(typeof inserted2._id).toBe('string')
  expect(inserted2.name).toBe('Andres')
})

it('Create Multiple - Should insert Multiple elements', async () => {
  const flock = [
    {
      age: 3,
      name: 'Goatee'
    },
    {
      age: 4,
      name: 'GoaToHell'
    },
    {
      age: 5,
      name: 'Oh!MyGoat'
    }
  ]

  const insertedFlock = await GoatModel.remote().insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0]._id
})

it('UpdateById - Should Update a single element', async () => {
  const goats = await GoatModel.remote().get()
  const data = await GoatModel.remote().updateById(goats[3]._id, { age: 99, name: 'MyUpdatedGoat' })
  expect(data.name).toBe('MyUpdatedGoat')
})

it('FindById - Should get the element by its Id', async () => {
  const goat = await GoatModel.remote().findById(storedId)
  expect(goat.name).toBe('Goatee')
})

it('DeleteById - Should delete the element by its Id', async () => {
  const id = await GoatModel.remote().deleteById(storedId)
  expect(id).toBe(storedId)
})

it('First - Should get a single element', async () => {
  const data = await GoatModel.remote().first()
  expect(data.name).toBe('Ignacio')
})

it('Pluck - Should get a single column', async () => {
  const names = await GoatModel.local().pluck(['name'])
  expect(Array.isArray(names)).toBe(true)
  expect(names[0]).toBe('Ignacio')
})

it('Select - Should get a single column', async () => {
  const names = await GoatModel.local().pluck(['name'])
  expect(Array.isArray(names)).toBe(true)
  expect(names[0]).toBe('Ignacio')
})

it('Select - should filter specific columns', async () => {
  const goats = await GoatModel.remote().select(['name']).get()
  expect(goats[0].name).toBe('Ignacio')
})

it('Select - should select Nested Columns', async () => {
  const goats = await GoatModel.remote().select(['name'], ['breed', 'family']).get()

  expect(goats[0].breed.family).toBe('The Goats')
})

it('OrderBy - should order results asc', async () => {
  const goats = await GoatModel.remote().select(['name']).orderBy(['name'], 'desc').get()
  expect(goats[0].name).toBe('Oh!MyGoat')
})

it('Skip/Take - should restrict the results', async () => {
  const goats = await GoatModel.remote().select(['name']).orderBy(['name'], 'desc').skip(1).take(2).get()
  expect(goats.length).toBe(2)
  expect(goats[0].name).toBe('MyUpdatedGoat')
})

it('Offset/Limit - should restrict the results', async () => {
  const goats = await GoatModel.remote().select(['name']).orderBy(['name'], 'desc').offset(1).limit(2).get()
  expect(goats.length).toBe(2)
  expect(goats[0].name).toBe('MyUpdatedGoat')
})
