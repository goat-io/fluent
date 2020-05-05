/**
 * @jest-environment node
 */
import to from 'await-to-js'
import { Fluent } from '../../Fluent'
import { FormioConnector } from './FormioConnector'
import { Collection } from '../../Collection'

interface IGoat {
  name: string
  age: number
  breed?: {
    family: string
    members: number
  }
}

const authToken = 'ukC8G1KSJfXYmeEyKHaNXnuJgC8msa'
let collectData: Collection<IGoat>
let collectError: Error

const testModel = (() => {
  const _keys = Fluent.model<IGoat>('myFormioTestModel')

  const remote = (token?: string) => {
    return new FormioConnector<IGoat>({
      baseEndPoint: 'https://jwhwikkkyucndlj.form.io/mytestmodel',
      token: token || authToken
    })
  }

  return Object.freeze({ remote, _keys })
})()

beforeAll(async () => {
  const inserted = await testModel.remote().insert({
    name: 'Ignacio',
    age: 29
  })

  const inserted2 = await testModel.remote().insert({
    name: 'Andres',
    age: 15
  })
})

it('Should insert Data', async () => {
  const inserted = await testModel.remote().insert({
    name: 'Ignacio',
    age: 29
  })

  const inserted2 = await testModel.remote().insert({
    name: 'Andres',
    age: 15
  })

  expect(typeof inserted._id).toBe('string')
  expect(typeof inserted2._id).toBe('string')
  expect(inserted2.name).toBe('Andres')
})

it('Should get remote data', async () => {
  const [error, data] = await to(testModel.remote().get())

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Ignacio')
})

it('select() should filter and name specific columns', async () => {
  const [error, data] = await to(testModel.remote().select(testModel._keys.name).get())

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].age).toBe(undefined)
  expect(data[0].name).toBe('Ignacio')
})

it('pluck() should return a single array', async () => {
  const [error, data] = await to(testModel.remote().pluck(testModel._keys.name))

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0]).toBe('Ignacio')
})

it('orderBy() should order results desc', async () => {
  const [error, data] = await to(
    testModel.remote().select(testModel._keys.name).orderBy(testModel._keys.name, 'desc').get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Ignacio')
})

it('orderBy() should order results asc', async () => {
  const [error, data] = await to(
    testModel.remote().select(testModel._keys.name).orderBy(testModel._keys.name, 'asc').get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Andres')
})

it('orderBy() should order by Dates with Select()', async () => {
  const [error, data] = await to(
    testModel
      .remote()
      .select(testModel._keys.name, testModel._keys.created)
      .orderBy(testModel._keys.created, 'asc')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }
  expect(data[0].name).toBe('Ignacio')
})

it('orderBy() should order by Dates without Select()', async () => {
  const [error, data] = await to(testModel.remote().orderBy(testModel._keys.created, 'asc').get())

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Ignacio')
})

it('limit() should limit the amount of results', async () => {
  const [error, data] = await to(
    testModel
      .remote()
      .select(testModel._keys.name, testModel._keys.created)
      .orderBy(testModel._keys.created, 'asc', 'date')
      .limit(1)
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }
  expect(data.length).toBe(1)
})

it('offset() should start at the given position', async () => {
  const [error, data] = await to(
    testModel
      .remote()
      .select(testModel._keys.name, testModel._keys.created)
      .orderBy(testModel._keys.created, 'desc')
      .limit(1)
      .offset(1)
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Andres')
})

it('where() should filter the data', async () => {
  const [error, data] = await to(
    testModel
      .remote()
      .where(testModel._keys.name, '=', 'Andres')
      .select(testModel._keys.name, testModel._keys.created)
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].name).toBe('Andres')
})

it('first() should take the first result from data', async () => {
  const [error, data] = await to(
    testModel
      .remote()
      .where(testModel._keys.name, '=', 'Ignacio')
      .select(testModel._keys.name, testModel._keys.created)
      .first()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data.name).toBe('Ignacio')
})

it('collect() should return the data as collection', async () => {
  ;[collectError, collectData] = await to(testModel.remote().collect())

  if (collectError) {
    console.log(collectError)
    throw new Error('Cannot get remote Model')
  }
  const avg = collectData.avg(testModel._keys.age)

  expect(avg).toBe(22)
})

it('avg() should calculate avg on an obj attribute', () => {
  const avg = collectData.avg(testModel._keys.age)

  expect(avg).toBe(22)
})

it('chunk() and collapse() an array', async () => {
  ;[collectError, collectData] = await to(testModel.remote().collect())
  const chunk = collectData.chunk(1).get()

  expect(chunk[0].length).toBe(1)
})

it('clear() should remove all records from the Model', async () => {
  const [error, data] = await to(testModel.remote().truncate({ sure: true }))

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  const [error1, data1] = await to(testModel.remote().select(testModel._keys._id).get())

  if (error1) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data1.length).toBe(0)
})
