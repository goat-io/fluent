import 'reflect-metadata'
import { Promises } from '@goatlab/js-utils'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initialize } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { flock } from '../flock'
import {
  GoatRepositoryFactory,
  TypeOrmRepositoryFactory,
} from '../repository.factory'
import { MongoDBTestContainer } from '../testcontainers/mongodb.testcontainer'

describe('MongoDB Tests with Testcontainers', () => {
  let container: MongoDBTestContainer
  let GoatRepo: GoatRepositoryFactory
  let TypeOrmRepo: TypeOrmRepositoryFactory

  beforeAll(async () => {
    container = new MongoDBTestContainer()
    const dataSource = await container.start()

    // Initialize Fluent with entities
    await initialize([dataSource], dbEntities)

    // Create repositories with dynamic datasource
    GoatRepo = new GoatRepositoryFactory(dataSource)
    TypeOrmRepo = new TypeOrmRepositoryFactory(dataSource)
  }, 60000)

  afterAll(async () => {
    await container.stop()
  })

  describe('Basic Tests', () => {
    it('insert - Should insert data', async () => {
      const a = await GoatRepo.insert({ name: 'myGoat', age: 13 })
      expect(typeof a.id).toBe('string')
      expect(a.name).toBe('myGoat')
    })

    it('insert - Should insert data with customId', async () => {
      const a = await GoatRepo.insert({
        id: '631ce4304f9183f61ffb613a',
        name: 'myGoat',
        age: 13,
      })
      expect(typeof a.id).toBe('string')
      expect(a.id).toBe('631ce4304f9183f61ffb613a')
    })

    it('insertMany - Should insert Multiple elements', async () => {
      const insertedFlock = await GoatRepo.insertMany(flock)
      expect(insertedFlock[0].name).toBe('Goatee')
    })

    it('findById - Should GET an object by its ID', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const goat = await GoatRepo.findById(goats[0].id!)
      expect(goat?.id).toBe(goats[0].id)
      expect(typeof goat?.id).toBe('string')

      const anotherGoat = await GoatRepo.findById('507f1f77bcf86cd799439011')
      expect(anotherGoat).toBe(null)
    })

    it('findById - Should GET selected Data', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const goat = await GoatRepo.findById(goats[0].id!, {
        select: {
          age: true,
        },
      })

      expect(goat).not.toHaveProperty('name')
      expect(goat?.age).toBe(goats[0].age)
    })

    it('findByIds - Should GET data', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const ids = [goats[0].id!, goats[1].id!]

      const selectedGoats = await GoatRepo.findByIds(ids)

      expect(selectedGoats.length).toBe(2)

      expect(
        selectedGoats[0].id === ids[0] || selectedGoats[1].id === ids[0],
      ).toBe(true)
    })

    it('findByIds - Should GET selectedData', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const ids = [goats[0].id!, goats[1].id!]
      const ages = [goats[0].age, goats[1].age]

      const selectedGoats = await GoatRepo.findByIds(ids, {
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

    it('findMany - Should GET data', async () => {
      await GoatRepo.insertMany(flock)
      const storedGoats = await GoatRepo.findMany()

      expect(Array.isArray(storedGoats)).toBe(true)
      expect(typeof storedGoats[0].id).toBe('string')
    })

    it('findMany - Should FILTER data', async () => {
      await GoatRepo.insertMany(flock)

      const storedGoats = await GoatRepo.findMany({
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

    it('findMany - Should FILTER not existing data', async () => {
      await GoatRepo.insertMany(flock)
      const storedGoats = await GoatRepo.findMany({
        where: {
          name: 'SOMENOTEXISTINGGOAT',
        },
      })
      expect(Array.isArray(storedGoats)).toBe(true)
      expect(storedGoats.length).toBe(0)
    })

    it('findMany - Should SELECT attributes', async () => {
      await GoatRepo.insertMany(flock)
      const storedGoats = await GoatRepo.findMany({
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

    it('findFirst - Should get only 1 object back', async () => {
      await GoatRepo.insertMany(flock)

      const storedGoats = await GoatRepo.findFirst({
        where: {
          name: 'Goatee',
        },
      })

      expect(Array.isArray(storedGoats)).toBe(false)
      expect(typeof storedGoats!.id).toBe('string')
    })

    it('findFirst - Should FILTER AND SELECT DATA', async () => {
      await GoatRepo.insertMany(flock)

      const storedGoats = await GoatRepo.findFirst({
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

    it('requireFirst - Should fail if not found', async () => {
      const _insertedUser = await GoatRepo.insert({
        name: 'testGoat',
        age: 20,
      })

      const [error] = await Promises.try(
        GoatRepo.requireFirst({
          where: {
            name: 'noneExistingGoat',
          },
        }),
      )

      expect(error?.message).toBe(
        'No objects found matching:  {"where":{"name":"noneExistingGoat"}}',
      )
    })

    it('requireFirst - Should find first item', async () => {
      const insertedUser = await GoatRepo.insert({
        name: 'testGoat',
        age: 20,
      })

      const [error, goat] = await Promises.try(
        GoatRepo.requireFirst({
          where: {
            name: 'testGoat',
          },
        }),
      )

      expect(error).toBe(null)
      expect(goat.name).toBe(insertedUser.name)
    })

    it('UpdateById - Should Update a single element', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany()

      const data = await GoatRepo.updateById(goats[0].id!, {
        age: 99,
        name: 'MyUpdatedGoat',
      })
      expect(data.name).toBe('MyUpdatedGoat')
      expect(data.id).toBe(goats[0].id!)
    })

    it('ReplaceById - Should Update a single element', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany()
      const data = await GoatRepo.replaceById(goats[0].id!, {
        age: 2,
        name: 'MyReplacedGoat',
      })
      expect(data.name).toBe('MyReplacedGoat')
      expect(data.id).toBe(goats[0].id!)
    })

    it('deleteById - Should delete an item', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany()
      const foundGoat = await GoatRepo.requireById(goats[0].id!)

      expect(foundGoat.id).toBe(goats[0].id)

      await GoatRepo.deleteById(foundGoat.id!)

      const [error] = await Promises.try(GoatRepo.requireById(goats[0].id!))

      expect(error?.message).toBe(`Object ${goats[0].id} not found`)
    })
  })

  describe('Advanced Tests', () => {
    const insertTestData = async () => {
      await TypeOrmRepo.insert({
        created: '2018-12-03',
        nestedTest: {
          a: ['6', '5', '4'],
          b: { c: true, d: ['2', '1', '0'] },
          c: 4,
        },
        order: 1,
        test: true,
      })

      await TypeOrmRepo.insert({
        created: '2017-12-03',
        nestedTest: {
          a: ['3', '2', '1'],
          b: { c: true, d: ['1', '1', '0'] },
          c: 3,
        },
        order: 2,
        test: false,
      })

      await TypeOrmRepo.insert({
        created: '2016-12-03',
        nestedTest: {
          a: ['0', '-1', '-2'],
          b: { c: true, d: ['0', '1', '0'] },
          c: 2,
        },
        order: 3,
        test: false,
      })
    }

    it('findFirst() should take the first result from data', async () => {
      await insertTestData()

      const form = await TypeOrmRepo.findFirst({
        select: {
          id: true,
          test: true,
          nestedTest: {
            c: true,
            a: true,
          },
        },
        where: {
          nestedTest: {
            c: {
              greaterOrEqualThan: 3,
            },
          },
        },
      })
      expect(!Array.isArray(form)).toBe(true)
      expect(typeof form.nestedTest.c).toBe('number')
      expect(form.nestedTest.c >= 3).toBe(true)
    })

    it('Should get local data', async () => {
      await insertTestData()
      const data = await TypeOrmRepo.findMany()
      expect(Array.isArray(data)).toBe(true)
      expect(typeof data[0].nestedTest.b.c).toBe('boolean')
    })

    it('pluck() should return a single array', async () => {
      await insertTestData()
      const data = await TypeOrmRepo.pluck({ test: true })
      expect(typeof data[0]).toBe('boolean')
    })

    it('limit() should limit the amount of results', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          test: true,
          nestedTest: {
            c: true,
            a: true,
          },
          created: true,
          order: true,
        },
        limit: 2,
        orderBy: [{ created: 'asc' }],
      })

      expect(forms.length > 0).toBe(true)
      expect(forms.length <= 2).toBe(true)
    })

    it('offset() should start at the given position', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          test: true,
          nestedTest: {
            c: true,
            a: true,
          },
        },
        offset: 1,
        limit: 1,
      })

      expect(forms.length).toBe(1)
    })

    it('where() should filter the data', async () => {
      await insertTestData()

      const forms = await TypeOrmRepo.findMany({
        where: {
          nestedTest: {
            c: {
              greaterOrEqualThan: 3,
            },
          },
        },
      })

      expect(forms.length > 0).toBe(true)

      forms.forEach(form => {
        expect(form.nestedTest.c >= 3).toBe(true)
      })
    })

    it('andWhere() should filter the data', async () => {
      const forms = await TypeOrmRepo.findMany({
        where: {
          AND: [
            {
              nestedTest: {
                c: {
                  greaterOrEqualThan: 3,
                },
              },
            },
            {
              order: 2,
            },
          ],
        },
        limit: 1,
      })

      expect(forms.length).toBe(1)
      expect(forms[0].nestedTest.c >= 3).toBe(true)
      expect(forms[0].order).toBe(2)
    })

    it('orWhere() should filter the data', async () => {
      const forms = await TypeOrmRepo.findMany({
        where: {
          OR: [
            {
              nestedTest: {
                c: {
                  greaterOrEqualThan: 5,
                },
              },
            },

            {
              order: 2,
            },
          ],
        },
        limit: 1,
      })

      expect(forms.length).toBe(1)
      expect(forms[0].order).toBe(2)
    })

    it('orderBy() should order results desc', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          test: true,
          order: true,
          nestedTest: {
            c: true,
            a: true,
            b: {
              c: true,
              d: true,
            },
          },
        },
        orderBy: [
          {
            order: 'desc',
          },
        ],
      })

      expect(forms[0].order).toBe(3)
      expect(forms[0].nestedTest.b.c).toBe(true)
    })

    it('orderBy() should order results asc', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          test: true,
          order: true,
          nestedTest: {
            c: true,
            a: true,
            b: {
              c: true,
              d: true,
            },
          },
        },
        orderBy: [
          {
            order: 'asc',
          },
        ],
      })

      expect(forms[0].order).toBe(1)
    })

    it('orderBy() should order by Dates with Select()', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          test: true,
          order: true,
          nestedTest: {
            c: true,
            a: true,
            b: {
              c: true,
              d: true,
            },
          },
        },
        orderBy: [
          {
            created: 'asc',
          },
        ],
      })

      // MongoDB CreateDateColumn ignores provided dates and uses current timestamp
      // First inserted (order: 1) will have oldest timestamp when sorted ASC
      expect(forms[0].order).toBe(1)
    })

    it('orderBy() should order by Dates without Select()', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        orderBy: [
          {
            created: 'asc',
          },
        ],
      })

      // MongoDB CreateDateColumn ignores provided dates and uses current timestamp
      // First inserted (order: 1) will have oldest timestamp when sorted ASC
      expect(forms[0].order).toBe(1)
    })
  })
})
