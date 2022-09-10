export const advancedTestSuite = Model => {
  beforeAll(() => {
    try {
      Model = new Model()
    } catch (error) {}
  })
  /**
   *
   */
  const insertTestData = async Repository => {
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

    expect(forms[0].order).toBe(3)
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

    expect(forms[0].order).toBe(3)
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
