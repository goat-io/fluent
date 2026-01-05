import { Promises } from '@goatlab/js-utils'
import { DataSource } from 'typeorm'
import { beforeAll, expect, it, test } from 'vitest'
import { flock } from '../flock'
import { GoatRepositoryFactory } from '../repository.factory'

export const basicTestSuite = (
  dataSourceOrRepoClass?: DataSource | any | (() => DataSource),
) => {
  let _storedId: any
  let dbType: string = 'unknown'

  let Repository: any
  beforeAll(async () => {
    if (!dataSourceOrRepoClass) {
      // For backward compatibility with SQLite tests - dynamic import to avoid initialization issues
      const module = await import('./goat.repository')
      Repository = new module.GoatRepository()
      dbType = 'sqlite'
    } else if (typeof dataSourceOrRepoClass === 'function') {
      // Check if it's a getter function or a repository class
      try {
        const result = dataSourceOrRepoClass()
        if (result && typeof result === 'object' && 'options' in result) {
          // It's a getter function returning a DataSource
          Repository = new GoatRepositoryFactory(result)
          dbType = result.options.type || 'unknown'
        } else {
          // The function returned something else, might be a constructor issue
          Repository = new dataSourceOrRepoClass()
          if (Repository.dataSource) {
            dbType = Repository.dataSource.options.type || 'unknown'
          }
        }
      } catch (_e) {
        // It's a class constructor, not a regular function
        Repository = new dataSourceOrRepoClass()
        // Try to determine db type from repository
        if (Repository.dataSource) {
          dbType = Repository.dataSource.options.type || 'unknown'
        }
      }
    } else {
      // Handle DataSource
      Repository = new GoatRepositoryFactory(dataSourceOrRepoClass)
      dbType = dataSourceOrRepoClass.options.type || 'unknown'
    }
  })

  test('insert - Should  insert data', async () => {
    const a = await Repository.insert({ name: 'myGoat', age: 13 })
    expect(typeof a.id).toBe('string')
    expect(a.name).toBe('myGoat')
    expect(0).toBe(0)
  })

  test('insert - Should  insert data with customId', async () => {
    // Use proper UUID for PostgreSQL, MongoDB ObjectId for others
    const customId =
      dbType === 'postgres'
        ? '550e8400-e29b-41d4-a716-446655440000'
        : '631ce4304f9183f61ffb613a'

    const a = await Repository.insert({
      id: customId,
      name: 'myGoat',
      age: 13,
    })
    expect(typeof a.id).toBe('string')
    expect(a.id).toBe(customId)
  })

  it('insertMany - Should insert Multiple elements', async () => {
    const insertedFlock = await Repository.insertMany(flock)
    expect(insertedFlock[0].name).toBe('Goatee')
    _storedId = insertedFlock[0].id
  })

  test('findById - Should  GET an object by its ID', async () => {
    const goats = await Repository.insertMany(flock)

    const goat = await Repository.findById(goats[0].id!)
    expect(goat?.id).toBe(goats[0].id)
    expect(typeof goat?.id).toBe('string')

    // Use proper UUID for PostgreSQL
    const nonExistentId =
      dbType === 'postgres'
        ? '550e8400-e29b-41d4-a716-446655440001'
        : '507f1f77bcf86cd799439011'
    const anotherGoat = await Repository.findById(nonExistentId)
    expect(anotherGoat).toBe(null)
  })

  test('findById - Should  GET selected Data', async () => {
    const goats = await Repository.insertMany(flock)

    const goat = await Repository.findById(goats[0].id!, {
      select: {
        age: true,
      },
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
      selectedGoats[0].id === ids[0] || selectedGoats[1].id === ids[0],
    ).toBe(true)
  })

  test('findByIds - Should  GET selectedData', async () => {
    const goats = await Repository.insertMany(flock)

    const ids = [goats[0].id!, goats[1].id!]
    const ages = [goats[0].age, goats[1].age]

    const selectedGoats = await Repository.findByIds(ids, {
      select: {
        age: true,
      },
    })

    expect(selectedGoats.length).toBe(2)

    expect(
      selectedGoats[0].age === ages[0] || selectedGoats[1].age === ages[0],
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
        name: 'Goatee',
      },
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
        name: 'SOMENOTEXISTINGGOAT',
      },
    })
    expect(Array.isArray(storedGoats)).toBe(true)
    expect(storedGoats.length).toBe(0)
  })

  test('findMany - Should  SELECT attributes', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany({
      where: {
        name: 'Goatee',
      },
      select: {
        age: true,
      },
    })

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(storedGoats.length > 0).toBe(true)
    expect(storedGoats[0]).not.toHaveProperty('name')
  })

  test('findFirst - Should  get only 1 object back', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee',
      },
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(typeof storedGoats!.id).toBe('string')
  })

  test('findFirst - Should  FILTER AND SELECT DATA', async () => {
    await Repository.insertMany(flock)

    const storedGoats = await Repository.findFirst({
      where: {
        name: 'Goatee',
      },
      select: {
        name: true,
        age: true,
      },
    })

    expect(Array.isArray(storedGoats)).toBe(false)
    expect(storedGoats!.name).toBe('Goatee')
    expect(storedGoats).not.toHaveProperty('id')
  })

  test('requireFirst - Should fail if not found', async () => {
    const _insertedUser = await Repository.insert({
      name: 'testGoat',
      age: 20,
    })

    const [error] = await Promises.try(
      Repository.requireFirst({
        where: {
          name: 'noneExistingGoat',
        },
      }),
    )

    expect(error?.message).toBe(
      'No objects found matching:  {"where":{"name":"noneExistingGoat"}}',
    )
  })

  test('requireFirst - Should find first item', async () => {
    const insertedUser = await Repository.insert({
      name: 'testGoat',
      age: 20,
    })

    const [error, goat] = await Promises.try(
      Repository.requireFirst({
        where: {
          name: 'testGoat',
        },
      }),
    )

    expect(error).toBe(null)
    expect(goat.name).toBe(insertedUser.name)
  })

  it('UpdateById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()

    const data = await Repository.updateById(goats[0].id!, {
      age: 99,
      name: 'MyUpdatedGoat',
    })
    expect(data.name).toBe('MyUpdatedGoat')
    expect(data.id).toBe(goats[0].id!)
  })

  it('ReplaceById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const data = await Repository.replaceById(goats[0].id!, {
      age: 2,
      name: 'MyReplacedGoat',
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
