import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FormioAdvancedRepository } from './repository.factory'

// Mock implementation of the advanced test suite for FormIO connector
const advancedTestSuite = (Repository: FormioAdvancedRepository) => {
  beforeEach(async () => {
    await Repository.clear()
  })

  afterEach(async () => {
    await Repository.clear()
  })

  const insertTestData = async (Repository: FormioAdvancedRepository) => {
    await Repository.insert({
      created: '2018-12-03',
      nestedTest: {
        a: ['6', '5', '4'],
        b: { c: true, d: ['2', '1', '0'] },
        c: 4,
      },
      order: 1,
      test: true,
    })

    await Repository.insert({
      created: '2017-12-03',
      nestedTest: {
        a: ['3', '2', '1'],
        b: { c: true, d: ['1', '1', '0'] },
        c: 3,
      },
      order: 2,
      test: false,
    })

    await Repository.insert({
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

  test('findFirst() should take the first result from data', async () => {
    await insertTestData(Repository)

    const form = await Repository.findFirst({
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
    expect(typeof form!.nestedTest.c).toBe('number')
    expect(form!.nestedTest.c >= 3).toBe(true)
  })

  test('Should get local data', async () => {
    await insertTestData(Repository)
    const data = await Repository.findMany()
    expect(Array.isArray(data)).toBe(true)
    expect(typeof data[0].nestedTest.b.c).toBe('boolean')
  })

  test('pluck() should return a single array', async () => {
    await insertTestData(Repository)
    const data = await Repository.pluck('test')
    expect(typeof data[0]).toBe('boolean')
  })

  test('limit() should limit the amount of results', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
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

  test('offset() should start at the given position', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
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

  test('where() should filter the data', async () => {
    await insertTestData(Repository)

    const forms = await Repository.findMany({
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

  test('andWhere() should filter the data', async () => {
    await insertTestData(Repository)

    const forms = await Repository.findMany({
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

  test('orWhere() should filter the data', async () => {
    await insertTestData(Repository)

    const forms = await Repository.findMany({
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

  test('orderBy() should order results desc', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
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

  test('orderBy() should order results asc', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
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

  test('orderBy() should order by Dates with Select()', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
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

    expect(forms[0].order).toBe(3)
  })

  test('orderBy() should order by Dates without Select()', async () => {
    await insertTestData(Repository)
    const forms = await Repository.findMany({
      orderBy: [
        {
          created: 'asc',
        },
      ],
    })

    expect(forms[0].order).toBe(3)
  })
}

describe('FormIO Connector - Advanced Tests', () => {
  const Repository = new FormioAdvancedRepository()
  advancedTestSuite(Repository)
})
