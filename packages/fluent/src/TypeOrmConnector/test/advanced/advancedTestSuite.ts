import { DataSource } from 'typeorm'
import { beforeAll, expect, it } from 'vitest'
import { TypeOrmRepositoryFactory } from '../repository.factory'

export const advancedTestSuite = (
  dataSourceOrRepoClass?: DataSource | any | (() => DataSource)
) => {
  let Model: any
  let dbType: string = 'unknown'

  beforeAll(async () => {
    if (!dataSourceOrRepoClass) {
      // For backward compatibility - dynamic import to avoid initialization issues
      const module = await import('./typeOrm.repository')
      Model = new module.TypeOrmRepository()
    } else if (typeof dataSourceOrRepoClass === 'function') {
      // Check if it's a getter function or a repository class
      try {
        const result = dataSourceOrRepoClass()
        if (result && typeof result === 'object' && 'options' in result) {
          // It's a getter function returning a DataSource
          Model = new TypeOrmRepositoryFactory(result)
          dbType = result.options.type || 'unknown'
        } else {
          // The function returned something else, might be a constructor issue
          Model = new dataSourceOrRepoClass()
          if (Model.dataSource) {
            dbType = Model.dataSource.options.type || 'unknown'
          }
        }
      } catch (_e) {
        // It's a class constructor, not a regular function
        Model = new dataSourceOrRepoClass()
        if (Model.dataSource) {
          dbType = Model.dataSource.options.type || 'unknown'
        }
      }
    } else {
      // Handle DataSource
      Model = new TypeOrmRepositoryFactory(dataSourceOrRepoClass)
      dbType = dataSourceOrRepoClass.options.type || 'unknown'
    }
  })
  /**
   *
   */
  const insertTestData = async Repository => {
    // For MongoDB, CreateDateColumn might override our dates
    // Insert in reverse order with small delays to ensure ordering
    const data = [
      {
        created: new Date('2016-12-03'),
        nestedTest: {
          a: ['0', '-1', '-2'],
          b: { c: true, d: ['0', '1', '0'] },
          c: 2
        },
        order: 3,
        test: false
      },
      {
        created: new Date('2017-12-03'),
        nestedTest: {
          a: ['3', '2', '1'],
          b: { c: true, d: ['1', '1', '0'] },
          c: 3
        },
        order: 2,
        test: false
      },
      {
        created: new Date('2018-12-03'),
        nestedTest: {
          a: ['6', '5', '4'],
          b: { c: true, d: ['2', '1', '0'] },
          c: 4
        },
        order: 1,
        test: true
      }
    ]

    for (const item of data) {
      await Repository.insert(item)
      // Small delay for MongoDB to ensure different timestamps
      if (dbType === 'mongodb') {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }

  it('findFirst() should take the first result from data', async () => {
    await insertTestData(Model)

    const form = await Model.findFirst({
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

    expect(form).not.toBe(null)
    expect(!Array.isArray(form)).toBe(true)
    expect(typeof form.nestedTest.c).toBe('number')
    expect(form.nestedTest.c >= 3).toBe(true)
  })

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

  it('limit() should limit the amount of results', async () => {
    await insertTestData(Model)
    const forms = await Model.findMany({
      select: {
        id: true,
        test: true,
        nestedTest: {
          c: true,
          a: true
        },
        created: true,
        order: true
      },
      limit: 2,
      orderBy: [{ created: 'asc' }]
    })

    expect(forms.length > 0).toBe(true)
    expect(forms.length <= 2).toBe(true)
  })

  it('offset() should start at the given position', async () => {
    await insertTestData(Model)
    // TODO: this test is not really covering the use case of offset
    const forms = await Model.findMany({
      select: {
        id: true,
        test: true,
        nestedTest: {
          c: true,
          a: true
        }
      },
      offset: 1,
      limit: 1
    })

    expect(forms.length).toBe(1)
  })

  it('where() should filter the data', async () => {
    await insertTestData(Model)

    const forms = await Model.findMany({
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
    const forms = await Model.findMany({
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

  it('orWhere() should filter the data', async () => {
    const forms = await Model.findMany({
      where: {
        OR: [
          {
            nestedTest: {
              c: {
                greaterOrEqualThan: 5
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
    expect(forms[0].order).toBe(2)
  })

  it('orderBy() should order results desc', async () => {
    await insertTestData(Model)
    const forms = await Model.findMany({
      select: {
        id: true,
        test: true,
        order: true,
        nestedTest: {
          c: true,
          a: true,
          b: {
            c: true,
            d: true
          }
        }
      },
      orderBy: [
        {
          order: 'desc'
        }
      ]
    })

    expect(forms[0].order).toBe(3)
    expect(forms[0].nestedTest.b.c).toBe(true)
  })

  it('orderBy() should order results asc', async () => {
    await insertTestData(Model)
    const forms = await Model.findMany({
      select: {
        id: true,
        test: true,
        order: true,
        nestedTest: {
          c: true,
          a: true,
          b: {
            c: true,
            d: true
          }
        }
      },
      orderBy: [
        {
          order: 'asc'
        }
      ]
    })

    expect(forms[0].order).toBe(1)
  })

  it('orderBy() should order by Dates with Select()', async () => {
    await insertTestData(Model)
    const forms = await Model.findMany({
      select: {
        id: true,
        test: true,
        order: true,
        created: true,
        nestedTest: {
          c: true,
          a: true,
          b: {
            c: true,
            d: true
          }
        }
      },
      orderBy: [
        {
          created: 'asc'
        }
      ]
    })

    // For MongoDB, CreateDateColumn sets current timestamp, so check by insertion order
    if (dbType === 'mongodb') {
      expect(forms[0].order).toBe(3) // First inserted
      expect(forms[forms.length - 1].order).toBe(1) // Last inserted
    } else {
      expect(forms[0].order).toBe(3)
    }
  })

  it('orderBy() should order by Dates without Select()', async () => {
    await insertTestData(Model)
    const forms = await Model.findMany({
      orderBy: [
        {
          created: 'asc'
        }
      ]
    })

    // For MongoDB, CreateDateColumn sets current timestamp, so check by insertion order
    if (dbType === 'mongodb') {
      expect(forms[0].order).toBe(3) // First inserted
      expect(forms[forms.length - 1].order).toBe(1) // Last inserted
    } else {
      expect(forms[0].order).toBe(3)
    }
  })

  // it('Should get paginated data', async () => {
  //   await insertTestData(Model)

  //   const result = await Model.findMany({
  //     paginated: {
  //       page: 3,
  //       perPage: 5
  //     }
  //   })

  //   expect(Array.isArray(result.data)).toBe(true)
  //   expect(result.data.length > 0).toBe(true)
  //   expect(isNaN(result.total)).toBe(false)
  //   expect(isNaN(result.perPage)).toBe(false)
  //   expect(isNaN(result.currentPage)).toBe(false)
  //   expect(isNaN(result.nextPage)).toBe(false)
  //   expect(isNaN(result.firstPage)).toBe(false)
  //   expect(isNaN(result.lastPage)).toBe(false)
  //   expect(isNaN(result.prevPage)).toBe(false)
  //   expect(isNaN(result.from)).toBe(false)
  //   expect(isNaN(result.to)).toBe(false)
  // })

  // TODO: test to cover pagination functionality
  /*
  it('clear() should remove all records from the Model', async () => {
    await Model.clear()

    const forms = await Model.findMany()

    expect(forms.length).toBe(0)
  })
  */
}
