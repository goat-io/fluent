
import { Fluent } from '@goatlab/fluent'
import { advancedTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/advancedTestSuite'
import { basicTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/basicTestSuite'
import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { GoatRepository } from './goat.pouch.repository'
import {TypeOrmRepository} from './typeOrm.pouchdb.repository'

beforeAll(async ()=> {
  await Fluent.initialize([], dbEntities)

})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  // advancedTestSuite(TypeOrmRepository)
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
