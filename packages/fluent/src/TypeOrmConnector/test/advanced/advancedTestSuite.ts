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
        a: [6, 5, 4],
        b: { c: true, d: [2, 1, 0] },
        c: 4
      },
      order: 1,
      test: true
    })
    await Repository.insert({
      created: '2017-12-03',
      nestedTest: {
        a: [3, 2, 1],
        b: { c: true, d: [1, 1, 0] },
        c: 3
      },
      order: 2,
      test: false
    })
    await Repository.insert({
      created: '2016-12-03',
      nestedTest: {
        a: [0, -1, -2],
        b: { c: true, d: [0, 1, 0] },
        c: 2
      },
      order: 3,
      test: false
    })
  }

  it('Should get local data', async () => {
    await insertTestData(Model)
    const data = await Model.all()
    expect(Array.isArray(data)).toBe(true)
    expect(typeof data[0].nestedTest.b.c).toBe('boolean')
  })

  it('pluck() should return a single array', async () => {
    await insertTestData(Model)
    const data = await Model.pluck(keys=> keys.test)
    expect(typeof data[0]).toBe('boolean')
  })

  it('orderBy() should order results desc', async () => {
    await insertTestData(Model)
    const forms = await Model.select(
      keys => [keys.test, keys.nestedTest.b.c, keys.order]
    )
      .orderBy(keys => keys.order, 'desc')
      .get()
    expect(forms[0].order).toBe(3)
    expect(forms[0].nestedTest.b.c).toBe(true)
  })

  it('orderBy() should order results asc', async () => {
    await insertTestData(Model)
    const forms = await Model.select(
      keys => [keys.test, keys.nestedTest.b.c, keys.order]
    )
      .orderBy(keys => keys.order, 'asc')
      .get()

    expect(forms[0].order).toBe(1)
  })

  it('orderBy() should order by Dates with Select()', async () => {
    await insertTestData(Model)
    const forms = await Model.select( keys => [keys.created, keys.order])
      .orderBy(keys => keys.created, 'asc', 'date')
      .get()

    expect(forms[0].order).toBe(3)
  })

  it('orderBy() should order by Dates without Select()', async () => {
    await insertTestData(Model)
    const forms = await Model.orderBy(keys => keys.created, 'asc', 'date').get()

    expect(forms[0].order).toBe(3)
  })

  it('limit() should limit the amount of results', async () => {
    await insertTestData(Model)
    const forms = await Model.select(keys => [keys.created, keys.order])
      .orderBy(keys => keys.created, 'asc', 'date')
      .limit(2)
      .get()
    console.log('FOOORMS LENGTH', forms[0])
    expect(forms.length > 0).toBe(true)
    expect(forms.length <= 2).toBe(true)
  })

  it('offset() should start at the given position', async () => {
    await insertTestData(Model)
    const forms = await Model.select(keys => [keys.created, keys.order])
      .offset(1)
      .limit(1)
      .get()

    expect(forms.length).toBe(1)
  })

  it('where() should filter the data', async () => {
    await insertTestData(Model)

    const forms = await Model.where(keys => keys.nestedTest.c, '>=', 3).get()
    expect(forms.length > 0).toBe(true)

    forms.forEach(form => {
      expect(form.nestedTest.c >= 3).toBe(true)
    })
  })

  it('first() should take the first result from data', async () => {
    await insertTestData(Model)

    const form = await Model.select(keys => [keys.nestedTest.c, keys.id])
      .where(keys => keys.nestedTest.c, '>=', 3)
      .first()
    expect(typeof form.nestedTest.c).toBe('number')
  })

  /*
  it('Should get paginated data', async () => {
    await insertTestData(Model)
    const data = await Model.paginate({ page: 1, perPage: 10 })
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length > 0).toBe(true)
  })
*/
  /*
  it('clear() should remove all records from the Model', async () => {
    await Model.clear({ sure: true })

    const forms = await Model.all()

    expect(forms.length).toBe(0)
  })
  */

  /*
  // TODO This query requires an index

    it('andWhere() should filter the data', async () => {
    const forms = await Model.where(Model._keys.nestedTest.c, '>=', 3)
      .andWhere(Model._keys.order, '=', 2)
      .limit(1)
      .get()
    expect(forms.length).toBe(1)
    expect(forms[0].order).toBe(2)
  })

  
  it('orWhere() should filter the data', async () => {
    const forms = await Model.where(Model._keys.nestedTest.c, '>', 5)
      .orWhere(Model._keys.order, '=', 2)
      .limit(1)
      .get()
    expect(forms.length).toBe(1)
    expect(forms[0].order).toBe(2)
  })






  /*

  */
}
