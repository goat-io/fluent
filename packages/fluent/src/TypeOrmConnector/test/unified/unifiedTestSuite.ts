import { describe, it, expect, beforeAll } from 'vitest'
import { DataSource } from 'typeorm'
import { GoatRepositoryFactory, TypeOrmRepositoryFactory } from '../repository.factory'
import { flock } from '../flock'
import { Promises } from '@goatlab/js-utils'

export interface UnifiedTestOptions {
  dataSource: DataSource | (() => DataSource)
  dbType: 'mysql' | 'postgresql' | 'mongodb' | 'sqlite'
}

export const unifiedTestSuite = (options: UnifiedTestOptions) => {
  const { dataSource: dataSourceOrFn, dbType } = options
  
  let GoatRepo: GoatRepositoryFactory
  let TypeOrmRepo: TypeOrmRepositoryFactory

  beforeAll(() => {
    const dataSource = typeof dataSourceOrFn === 'function' ? dataSourceOrFn() : dataSourceOrFn
    if (!dataSource) {
      throw new Error('DataSource is required for unified tests')
    }
    GoatRepo = new GoatRepositoryFactory(dataSource)
    TypeOrmRepo = new TypeOrmRepositoryFactory(dataSource)
  })

  describe('Basic Tests', () => {
    beforeEach(async () => {
      // Clear data before each test to ensure clean state
      await GoatRepo.clear()
    })
    
    it('insert - Should insert data', async () => {
      const a = await GoatRepo.insert({ name: 'myGoat', age: 13 })
      expect(typeof a.id).toBe('string')
      expect(a.name).toBe('myGoat')
    })

    it('insert - Should insert data with customId', async () => {
      const customId = dbType === 'postgresql' 
        ? '550e8400-e29b-41d4-a716-446655440000'
        : '631ce4304f9183f61ffb613a'
        
      const a = await GoatRepo.insert({
        id: customId,
        name: 'myGoat',
        age: 13
      })
      expect(typeof a.id).toBe('string')
      expect(a.id).toBe(customId)
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

      const nonExistentId = dbType === 'postgresql'
        ? '550e8400-e29b-41d4-a716-446655440001'
        : '507f1f77bcf86cd799439011'
        
      const anotherGoat = await GoatRepo.findById(nonExistentId)
      expect(anotherGoat).toBe(null)
    })

    it('findById - Should GET selected Data', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const goat = await GoatRepo.findById(goats[0].id!, {
        select: {
          id: false,
          age: true
        }
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
        selectedGoats.find(goat => goat.id == goats[0].id!)?.name
      ).toBe(goats[0].name)
      expect(
        selectedGoats.find(goat => goat.id == goats[1].id!)?.name
      ).toBe(goats[1].name)
    })

    it('findByIds - Should GET selectedData', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const ids = [goats[0].id!, goats[1].id!]
      const selectedGoats = await GoatRepo.findByIds(ids, {
        select: {
          id: true,
          name: false,
          age: true
        }
      })

      expect(selectedGoats.length).toBe(2)

      expect(
        selectedGoats.find(goat => goat.id == goats[0].id!)
      ).not.toHaveProperty('name')
      expect(
        selectedGoats.find(goat => goat.id == goats[0].id!)?.age
      ).toBe(goats[0].age)
    })

    it('findMany - Should GET data', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany()
      expect(goats.length).toBeGreaterThanOrEqual(flock.length)
    })

    it('findMany - Should FILTER data', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const data = await GoatRepo.findMany({
        where: {
          name: goats[1].name
        }
      })

      expect(data.length).toBeGreaterThanOrEqual(1)
      data.forEach(d => {
        expect(d.name).toBe(goats[1].name)
      })
    })

    it('findMany - Should FILTER not existing data', async () => {
      const data = await GoatRepo.findMany({
        where: {
          name: 'No Goat Has this Name'
        }
      })

      expect(data.length).toBe(0)
    })

    it('findMany - Should SELECT attributes', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const data = await GoatRepo.findMany({
        select: {
          name: true
        },
        where: {
          name: goats[0].name
        }
      })

      expect(data[0]).not.toHaveProperty('age')
    })

    it('findFirst - Should get only 1 object back', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const goat = await GoatRepo.findFirst({
        where: {
          name: goats[1].name
        }
      })

      expect(!Array.isArray(goat)).toBe(true)
      expect(goat?.id).toBeTruthy()
    })

    it('findFirst - Should FILTER AND SELECT DATA', async () => {
      const goats = await GoatRepo.insertMany(flock)

      const goat = await GoatRepo.findFirst({
        select: {
          name: true
        },
        where: {
          name: goats[2].name
        }
      })

      expect(!Array.isArray(goat)).toBe(true)
      expect(goat?.name).toBe(goats[2].name)
      expect(goat).not.toHaveProperty('age')
    })

    it('requireFirst - Should fail if not found', async () => {
      await expect(
        GoatRepo.requireFirst({
          where: {
            name: 'NO GOAT WITH THIS NAME'
          }
        })
      ).rejects.toThrow()
    })

    it('requireFirst - Should find first item', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const found = await GoatRepo.requireFirst({
        where: {
          name: goats[0].name
        }
      })
      expect(found.name).toBe(goats[0].name)
    })

    it('UpdateById - Should Update a single element', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const toUpdate = await GoatRepo.updateById(goats[0].id!, {
        name: 'UPDATED',
        age: goats[0].age
      })
      expect(toUpdate.name).toBe('UPDATED')
    })

    it('ReplaceById - Should Update a single element', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const toUpdate = await GoatRepo.replaceById(goats[0].id!, {
        name: 'REPLACED',
        age: 999
      })
      expect(toUpdate.name).toBe('REPLACED')
      expect(toUpdate.age).toBe(999)
    })

    it('deleteById - Should delete an item', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const deleted = await GoatRepo.requireById(goats[0].id!)
      await GoatRepo.deleteById(goats[0].id!)
      const found = await GoatRepo.findById(goats[0].id!)
      expect(found).toBe(null)
    })
  })

  describe('Advanced Tests', () => {
    beforeEach(async () => {
      // Clear data before each test to ensure clean state
      await TypeOrmRepo.clear()
    })
    
    const insertTestData = async () => {
      await TypeOrmRepo.insert({
        created: '2018-12-03',
        nestedTest: {
          a: ['6', '5', '4'],
          b: { c: true, d: ['2', '1', '0'] },
          c: 4
        },
        order: 1,
        test: true
      })

      await TypeOrmRepo.insert({
        created: '2017-12-03',
        nestedTest: {
          a: ['3', '2', '1'],
          b: { c: true, d: ['1', '1', '0'] },
          c: 3
        },
        order: 2,
        test: false
      })

      await TypeOrmRepo.insert({
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

    // Skip nested object query tests for MongoDB
    if (dbType !== 'mongodb') {
      it('findFirst() should take the first result from data', async () => {
        await insertTestData()

        const form = await TypeOrmRepo.findFirst({
          select: {
            id: true,
            test: true,
            nestedTest: {
              c: true,
              a: true
            }
          },
          where: {
            nestedTest: {
              c: {
                greaterOrEqualThan: 3
              }
            }
          }
        })
        expect(!Array.isArray(form)).toBe(true)
        expect(typeof form.nestedTest.c).toBe('number')
        expect(form.nestedTest.c >= 3).toBe(true)
      })

      it('where() should filter the data', async () => {
        await insertTestData()
        const forms = await TypeOrmRepo.findMany({
          where: {
            nestedTest: {
              c: {
                greaterOrEqualThan: 3
              }
            }
          }
        })

        expect(forms.length > 0).toBe(true)

        forms.forEach(form => {
          expect(form.nestedTest.c >= 3).toBe(true)
        })
      })

      it('andWhere() should filter the data', async () => {
        await insertTestData()
        const forms = await TypeOrmRepo.findMany({
          where: {
            AND: [
              {
                nestedTest: {
                  c: {
                    greaterOrEqualThan: 3
                  }
                }
              },
              {
                order: 2
              }
            ]
          },
          limit: 1
        })

        expect(forms.length).toBe(1)
        expect(forms[0].nestedTest.c >= 3).toBe(true)
        expect(forms[0].order).toBe(2)
      })
    }

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
          nestedTest: {
            c: true
          }
        },
        limit: 1
      })

      expect(forms.length).toBe(1)
      expect(typeof forms[0].nestedTest.c).toBe('number')
    })

    it('offset() should start at the given position', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          nestedTest: {
            c: true
          }
        },
        limit: 1,
        offset: 1
      })

      expect(forms.length).toBe(1)
      expect(typeof forms[0].nestedTest.c).toBe('number')
    })

    it('orWhere() should filter the data', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        where: {
          OR: [
            {
              order: 1
            },
            {
              order: 2
            }
          ]
        },
        limit: 2
      })

      expect(forms.length).toBe(2)
    })

    it('orderBy() should order results desc', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          nestedTest: {
            b: {
              c: true
            }
          },
          created: true
        },
        orderBy: {
          created: 'DESC'
        }
      })

      expect(forms[0].nestedTest.b.c).toBe(true)
      expect(forms[0].created).toBe('2018-12-03')
    })

    it('orderBy() should order results asc', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          nestedTest: {
            b: {
              c: true
            }
          },
          created: true
        },
        orderBy: {
          created: 'ASC'
        }
      })

      expect(forms[0].nestedTest.b.c).toBe(true)
      expect(forms[0].created).toBe('2016-12-03')
    })

    it('orderBy() should order by Dates with Select()', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        select: {
          id: true,
          nestedTest: {
            b: {
              c: true
            }
          },
          created: true
        },
        orderBy: {
          created: 'ASC'
        }
      })

      expect(forms[0].nestedTest.b.c).toBe(true)
      expect(forms[forms.length - 1].created).toBe('2018-12-03')
    })

    it('orderBy() should order by Dates without Select()', async () => {
      await insertTestData()
      const forms = await TypeOrmRepo.findMany({
        orderBy: {
          created: 'ASC'
        }
      })

      expect(forms[forms.length - 1].created).toBe('2018-12-03')
    })
  })
}