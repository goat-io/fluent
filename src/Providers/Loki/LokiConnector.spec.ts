import { Fluent } from '../../Fluent'
import { For } from '../../Helpers/For'
import { LokiConnector } from './LokiConnector'

interface ILockiData {
  created?: string
  nestedTest: { a: number[]; b: { c: boolean; d: number[] }; c: number }
  order?: number
  test: boolean
}

const testModel = new LokiConnector<ILockiData>('myTestModel')
const testModel2 = new LokiConnector<ILockiData>('testModel2')

beforeAll(async done => {
  await testModel.clear({ sure: true })
  await testModel.insert({
    created: '2018-12-03',
    nestedTest: { a: [6, 5, 4], b: { c: true, d: [2, 1, 0] }, c: 4 },
    order: 1,
    test: true
  })
  await testModel.insert({
    created: '2017-12-03',
    nestedTest: { a: [3, 2, 1], b: { c: true, d: [1, 1, 0] }, c: 3 },
    order: 2,
    test: false
  })
  await testModel.insert({
    created: '2016-12-03',
    nestedTest: { a: [0, -1, -2], b: { c: true, d: [0, 1, 0] }, c: 2 },
    order: 3,
    test: false
  })
  done()
})

it('Should insert Data', async () => {
  const data2 = await testModel2.insert({
    nestedTest: { a: [5, 4, 3], b: { c: true, d: [2, 1, 0] }, c: 1 },
    test: true
  })

  expect(typeof data2.id).toBe('string')
  expect(data2.nestedTest.a[0]).toBe(5)
})

it('Should get local data', async () => {
  const data = await testModel.all()
  expect(data.length).toBe(3)
  expect(data[0].nestedTest.a[0]).toBe(6)
})

it('pluck() should return a single array', async () => {
  const data = await testModel.pluck(testModel._keys.test)

  expect(data[0]).toBe(true)
})

it('orderBy() should order results desc', async () => {
  const forms = await testModel
    .select(
      testModel._keys.test,
      testModel._keys.nestedTest.b.c,
      testModel._keys.order
    )
    .orderBy(testModel._keys.order, 'desc')
    .get()

  expect(forms[0].order).toBe(3)
  expect(forms[0].nestedTest.b.c).toBe(true)
})

it('orderBy() should order results asc', async () => {
  const forms = await testModel
    .select(
      testModel._keys.test,
      testModel._keys.nestedTest.b.c,
      testModel._keys.order
    )
    .orderBy(testModel._keys.order, 'asc')
    .get()

  expect(forms[0].order).toBe(1)
})

it('orderBy() should order by Dates with Select()', async () => {
  const forms = await testModel

    .select(testModel._keys.created, testModel._keys.order)
    .orderBy(testModel._keys.created, 'asc', 'date')
    .get()

  expect(forms[0].order).toBe(3)
})

it('orderBy() should order by Dates without Select()', async () => {
  const forms = await testModel

    .orderBy(testModel._keys.created, 'asc', 'date')
    .get()

  expect(forms[0].order).toBe(3)
})

it('limit() should limit the amount of results', async () => {
  const forms = await testModel

    .select(testModel._keys.created, testModel._keys.order)
    .orderBy(testModel._keys.created, 'asc', 'date')
    .limit(2)
    .get()

  expect(forms.length).toBe(2)
})

it('offset() should start at the given position', async () => {
  const forms = await testModel

    .select(testModel._keys.created, testModel._keys.order)
    .offset(1)
    .limit(1)
    .get()

  expect(forms[0].order).toBe(2)
})

it('where() should filter the data', async () => {
  const forms = await testModel
    .where(testModel._keys.nestedTest.c, '>=', 3)
    .get()

  expect(forms.length).toBe(2)
})

it('andWhere() should filter the data', async () => {
  const forms = await testModel

    .where(testModel._keys.nestedTest.c, '>=', 3)
    .andWhere(testModel._keys.order, '=', 2)
    .get()
  expect(forms.length).toBe(1)
  expect(forms[0].order).toBe(2)
})

it('andWhere() should filter the data', async () => {
  const forms = await testModel

    .where(testModel._keys.nestedTest.c, '>=', 3)
    .orWhere(testModel._keys.order, '=', 2)
    .get()
  expect(forms.length).toBe(2)
  expect(forms[0].order).toBe(1)
})

it('first() should take the first result from data', async () => {
  const form = await testModel

    .where(testModel._keys.nestedTest.c, '>=', 3)
    .orderBy(testModel._keys.order, 'desc')
    .first()

  expect(form.order).toBe(2)
})

it('clear() should remove all records from the Model', async () => {
  await testModel.clear({ sure: true })
  await testModel2.clear({ sure: true })

  const forms = await testModel.all()

  expect(forms.length).toBe(0)
})

/*

it('select() should filter and name specific columns', async () => {
  const data = await testModel
  
    .select('nestedTest.b.d[2] as myCustomName', 'fake.a as myA', ['fake.b[1] as anotherB', 'fake.b.2.0.d as myvalue'])
    .get()

  expect(data[0].myCustomName).toBe(0)
})

*/
