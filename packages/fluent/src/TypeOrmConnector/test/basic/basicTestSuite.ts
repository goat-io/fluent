import { Promises } from '@goatlab/js-utils'
import { flock } from '../flock'
import { GoatRepository } from './goat.repository'

export const basicTestSuite = Repo => {
  let storedId: any

  let Repository: GoatRepository
  beforeAll(() => {
    Repository = new Repo()
  })

  test('insert - Should  insert data', async () => {
    const a = await Repository.insert({ name: 'myGoat', age: 13 })
    expect(typeof a.id).toBe('string')
    expect(a.name).toBe('myGoat')
    expect(0).toBe(0)
  })

  test('insert - Should  insert data with customId', async () => {
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

  test('findById - Should  GET an object by its ID', async () => {
    const goats = await Repository.insertMany(flock)

    const goat = await Repository.findById(goats[0].id!)

    expect(goat?.id).toBe(goats[0].id)
    expect(typeof goat?.id).toBe('string')

    const anotherGoat = await Repository.findById('507f1f77bcf86cd799439011')
    expect(anotherGoat).toBe(null)
  })

  test('findById - Should  GET selected Data', async () => {
    const goats = await Repository.insertMany(flock)

    const goat = await Repository.findById(goats[0].id!, {
      select: {
        age: true
      }
    })

    expect(goat).not.toHaveProperty('name')
    expect(goat?.age).toBe(goats[0].age)
  })

  test('findByIds - Should  GET data', async () => {
    const goats = await Repository.insertMany(flock)

    const ids = [goats[0].id!, goats[1].id!]

    const selectedGoats = await Repository.findByIds(ids)

    expect(selectedGoats.length).toBe(2)

    expect(
      selectedGoats[0].id === ids[0] || selectedGoats[1].id === ids[0]
    ).toBe(true)
  })

  test('findByIds - Should  GET selectedData', async () => {
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

  test('findMany - Should  GET data', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany()

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(typeof storedGoats[0].id).toBe('string')
  })

  test('findMany - Should  FILTER data', async () => {
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

  test('findMany - Should  FILTER not existing data', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany({
      where: {
        name: 'SOMENOTEXISTINGGOAT'
      }
    })
    expect(Array.isArray(storedGoats)).toBe(true)
    expect(storedGoats.length).toBe(0)
  })

  test('findMany - Should  SELECT attributes', async () => {
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

  test('findFirst - Should  get only 1 object back', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee'
      }
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(typeof storedGoats!.id).toBe('string')
  })

  test('findFirst - Should  FILTER AND SELECT DATA', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee'
      },
      select: {
        name: true
      }
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(storedGoats!.name).toBe('Goatee')
    expect(storedGoats).not.toHaveProperty('age')
  })

  test('requireFirst - Should fail if not found', async () => {
    const insertedUser = await Repository.insert({
      name: 'testGoat',
      age: 20
    })

    const [error] = await Promises.try(
      Repository.requireFirst({
        where: {
          name: 'noneExistingGoat'
        }
      })
    )

    expect(error?.message).toBe(
      'No objects found matching:  {"where":{"name":"noneExistingGoat"}}'
    )
  })

  test('requireFirst - Should find first item', async () => {
    const insertedUser = await Repository.insert({
      name: 'testGoat',
      age: 20
    })

    const [error, goat] = await Promises.try(
      Repository.requireFirst({
        where: {
          name: 'testGoat'
        }
      })
    )

    expect(error).toBe(null)
    expect(goat.name).toBe(insertedUser.name)
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

  it('deleteById - Should delete an item', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const foundGoat = await Repository.requireById(goats[0].id!)

    expect(foundGoat.id).toBe(goats[0].id)

    await Repository.deleteById(foundGoat.id!)

    const [error] = await Promises.try(Repository.requireById(goats[0].id!))

    expect(error?.message).toBe(`Object ${goats[0].id} not found`)
  })
}
