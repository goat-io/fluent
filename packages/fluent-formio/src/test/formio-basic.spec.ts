import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { FormioGoatRepository } from './repository.factory'

// Mock implementation of the basic test suite for FormIO connector
const basicTestSuite = (Repository: FormioGoatRepository) => {
  let storedId: any

  beforeEach(async () => {
    await Repository.clear()
  })

  afterEach(async () => {
    await Repository.clear()
  })

  const flock = [
    { name: 'Goatee', age: 12 },
    { name: 'Billy', age: 8 },
    { name: 'Nanny', age: 15 },
    { name: 'Goatee', age: 10 }
  ]

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

  test('insertMany - Should insert Multiple elements', async () => {
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

  test('findById - Should GET selected Data', async () => {
    const goats = await Repository.insertMany(flock)
    const goat = await Repository.findById(goats[0].id!, {
      select: {
        age: true
      }
    })

    expect(goat).not.toHaveProperty('name')
    expect(goat?.age).toBe(goats[0].age)
  })

  test('findByIds - Should GET data', async () => {
    const goats = await Repository.insertMany(flock)
    const ids = [goats[0].id!, goats[1].id!]
    const selectedGoats = await Repository.findByIds(ids)

    expect(selectedGoats.length).toBe(2)
    expect(
      selectedGoats[0].id === ids[0] || selectedGoats[1].id === ids[0]
    ).toBe(true)
  })

  test('findByIds - Should GET selectedData', async () => {
    const goats = await Repository.insertMany(flock)
    const ids = [goats[0].id!, goats[1].id!]
    const ages = [goats[0].age, goats[1].age]

    const selectedGoats = await Repository.findByIds(ids, {
      select: {
        age: true
      }
    })

    expect(selectedGoats.length).toBe(2)
    expect(
      selectedGoats[0].age === ages[0] || selectedGoats[1].age === ages[0]
    ).toBe(true)
    expect(selectedGoats[0]).not.toHaveProperty('name')
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

  test('findMany - Should FILTER not existing data', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany({
      where: {
        name: 'SOMENOTEXISTINGGOAT'
      }
    })
    expect(Array.isArray(storedGoats)).toBe(true)
    expect(storedGoats.length).toBe(0)
  })

  test('findMany - Should SELECT attributes', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany({
      where: {
        name: 'Goatee'
      },
      select: {
        age: true
      }
    })

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(storedGoats.length > 0).toBe(true)
    expect(storedGoats[0]).not.toHaveProperty('name')
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

  test('findFirst - Should FILTER AND SELECT DATA', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee'
      },
      select: {
        name: true,
        age: true,
      }
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(storedGoats!.name).toBe('Goatee')
    expect(storedGoats).not.toHaveProperty('id')
  })

  test('updateById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()

    const data = await Repository.updateById(goats[0].id!, {
      age: 99,
      name: 'MyUpdatedGoat'
    })
    expect(data.name).toBe('MyUpdatedGoat')
    expect(data.id).toBe(goats[0].id!)
  })

  test('replaceById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const data = await Repository.replaceById(goats[0].id!, {
      age: 2,
      name: 'MyReplacedGoat'
    })
    expect(data.name).toBe('MyReplacedGoat')
    expect(data.id).toBe(goats[0].id!)
  })

  test('deleteById - Should delete an item', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const foundGoat = await Repository.requireById(goats[0].id!)

    expect(foundGoat.id).toBe(goats[0].id)

    await Repository.deleteById(foundGoat.id!)

    const deletedGoat = await Repository.findById(goats[0].id!)
    expect(deletedGoat).toBe(null)
  })
}

describe('FormIO Connector - Basic Tests', () => {
  const Repository = new FormioGoatRepository()
  basicTestSuite(Repository)
})