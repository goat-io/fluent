import { describe, test, it, expect, beforeAll, beforeEach } from 'vitest'
import { Fluent } from '@goatlab/fluent'
import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { GoatRepositoryFactory, TypeOrmRepositoryFactory } from './repository.factory'
import { flock } from '@goatlab/fluent/src/TypeOrmConnector/test/flock'
import { Promises } from '@goatlab/js-utils'

beforeAll(async () => {
  await Fluent.initialize([], dbEntities)
})

describe('PouchDB Basic Test Suite', () => {
  let Repository: GoatRepositoryFactory
  let storedId: any

  beforeEach(() => {
    Repository = new GoatRepositoryFactory()
  })

  test('insert - Should insert data', async () => {
    const a = await Repository.insert({ name: 'myGoat', age: 13 })
    expect(typeof a.id).toBe('string')
    expect(a.name).toBe('myGoat')
  })

  test('insert - Should insert data with customId', async () => {
    const a = await Repository.insert({
      id: '631ce4304f9183f61ffb613a',
      name: 'myGoat',
      age: 13
    })
    expect(typeof a.id).toBe('string')
    expect(a.id).toBe('631ce4304f9183f61ffb613a')
  })

  it('insertMany - Should insert Multiple elements', async () => {
    const insertedFlock = await Repository.insertMany(flock)
    expect(insertedFlock[0].name).toBe('Goatee')
    storedId = insertedFlock[0].id
  })

  test('findById - Should GET an object by its ID', async () => {
    const goats = await Repository.insertMany(flock)

    const goat = await Repository.findById(goats[0].id!)
    expect(goat?.id).toBe(goats[0].id)
    expect(typeof goat?.id).toBe('string')

    const anotherGoat = await Repository.findById('507f1f77bcf86cd799439011')
    expect(anotherGoat).toBe(null)
  })

  test('findMany - Should GET data', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany()

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(typeof storedGoats[0].id).toBe('string')
  })

  test('findMany - Should FILTER data', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findMany({
      where: {
        name: 'Goatee'
      }
    })

    expect(Array.isArray(storedGoats)).toBe(true)

    for (const goat of storedGoats) {
      expect(goat.name).toBe('Goatee')
    }
    expect(typeof storedGoats[0].id).toBe('string')
  })

  test('findFirst - Should get only 1 object back', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee'
      }
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(typeof storedGoats!.id).toBe('string')
  })

  it('UpdateById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()

    const data = await Repository.updateById(goats[0].id!, {
      age: 99,
      name: 'MyUpdatedGoat'
    })
    expect(data.name).toBe('MyUpdatedGoat')
    expect(data.id).toBe(goats[0].id!)
  })

  it('ReplaceById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const data = await Repository.replaceById(goats[0].id!, {
      age: 2,
      name: 'MyReplacedGoat'
    })
    expect(data.name).toBe('MyReplacedGoat')
    expect(data.id).toBe(goats[0].id!)
  })
})

describe('PouchDB Advanced Test Suite', () => {
  let Model: TypeOrmRepositoryFactory

  beforeEach(() => {
    Model = new TypeOrmRepositoryFactory()
  })

  const insertTestData = async (Repository) => {
    await Repository.insert({
      created: '2018-12-03',
      nestedTest: {
        a: ['6', '5', '4'],
        b: { c: true, d: ['2', '1', '0'] },
        c: 4
      },
      order: 1,
      test: true
    })

    await Repository.insert({
      created: '2017-12-03',
      nestedTest: {
        a: ['3', '2', '1'],
        b: { c: true, d: ['1', '1', '0'] },
        c: 3
      },
      order: 2,
      test: false
    })
    await Repository.insert({
      created: '2016-12-03',
      nestedTest: {
        a: ['0', '-1', '-2'],
        b: { c: true, d: ['0', '1', '0'] },
        c: 2
      },
      order: 3,
      test: false
    })
  }

  it('Should get local data', async () => {
    await insertTestData(Model)
    const data = await Model.findMany()
    expect(Array.isArray(data)).toBe(true)
    expect(typeof data[0].nestedTest.b.c).toBe('boolean')
  })

  it('pluck() should return a single array', async () => {
    await insertTestData(Model)
    const data = await Model.pluck({ test: true })
    expect(typeof data[0]).toBe('boolean')
  })
})

/*
test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  expect(Array.isArray(storedGoats)).toBe(true)
  expect(storedGoats.length).toBe(0)
})
it('Create Single - Should insert Data', async () => {
  const inserted = await GoatModel.insert({
    age: 29,
    name: 'Ignacio',
    breed: {
      members: 20,
      family: 'The Goats'
    }
  })

  const inserted2 = await GoatModel.insert({
    age: 15,
    name: 'Andres'
  })

  expect(typeof inserted.id).toBe('string')
  expect(typeof inserted2.id).toBe('string')
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

  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0].id
})
it('UpdateById - Should Update a single element', async () => {
  const goats = await GoatModel.get()
  const data = await GoatModel.updateById(goats[3].id, {
    age: 99,
    name: 'MyUpdatedGoat'
  })
  expect(data.name).toBe('MyUpdatedGoat')
})

it('FindById - Should get the element by its Id', async () => {
  const insertedGoat = await GoatModel.insert({
    age: 15,
    name: 'MyInsertedData'
  })

  const goat = await GoatModel.findById(insertedGoat.id)
  expect(goat.name).toBe('MyInsertedData')
})

it('DeleteById - Should delete the element by its Id', async () => {
  const id = await GoatModel.deleteById(storedId)
  expect(id).toBe(storedId)
})

it('First - Should get a single element', async () => {
  const data = await GoatModel.first()
  expect(data.name).toBe('Ignacio')
})

it('Pluck - Should get a single column', async () => {
  const names = await GoatModel.pluck(GoatModel._keys.name)
  expect(Array.isArray(names)).toBe(true)
  expect(names[0]).toBe('Ignacio')
})

it('Select - Should get a single column', async () => {
  const names = await GoatModel.pluck(GoatModel._keys.name)
  expect(Array.isArray(names)).toBe(true)
  expect(names[0]).toBe('Ignacio')
})

it('Select - should filter specific columns', async () => {
  const goats = await GoatModel.select(GoatModel._keys.name).get()
  expect(goats[0].name).toBe('Ignacio')
})

it('Select - should select Nested Columns', async () => {
  const goats = await GoatModel.select(
    GoatModel._keys.name,
    GoatModel._keys.breed.family
  ).get()
  expect(goats[0].breed.family).toBe('The Goats')
})

it('OrderBy - should order results asc', async () => {
  const goats = await GoatModel.select(GoatModel._keys.name)
    .orderBy(GoatModel._keys.name, 'desc')
    .get()
  expect(goats[0].name).toBe('Oh!MyGoat')
})

it('Skip/Take - should restrict the results', async () => {
  await GoatModel.clear()

  await GoatModel.insert({
    age: 15,
    name: 'Andres'
  })

  await GoatModel.insert({
    age: 15,
    name: 'Pedro'
  })

  const goats = await GoatModel.select(GoatModel._keys.name)
    .orderBy(GoatModel._keys.name, 'desc')
    .skip(1)
    .take(2)
    .get()

  expect(goats.length).toBe(1)

  expect(goats[0].name).toBe('Andres')
})

it('Offset/Limit - should restrict the results', async () => {
  await GoatModel.clear()

  await GoatModel.insert({
    age: 15,
    name: 'Andres'
  })

  await GoatModel.insert({
    age: 15,
    name: 'Pedro'
  })

  const goats = await GoatModel.select(GoatModel._keys.name)
    .orderBy(GoatModel._keys.name, 'asc')
    .offset(1)
    .limit(2)
    .get()
  expect(goats.length).toBe(1)
  expect(goats[0].name).toBe('Pedro')
})
*/
