/**
 * @jest-environment node
 */
import to from 'await-to-js'
import { Fluent } from '../../Fluent'
import { FormioConnector } from './FormioConnector'

let testModel
const token = 'w5h8l6pPWJ2ld990xCfApoPW74xKfA'
let collectData
let collectError

new Fluent().config({
  LOCAL_CONNECTORS: [],
  MERGE_CONNECTORS: [],
  REMOTE_CONNECTORS: [
    {
      baseUrl: 'https://suopywgtyuabhru.form.io',
      connector: FormioConnector,
      default: true,
      name: 'formio'
    }
  ]
})

testModel = Fluent.model('myTestModel', {
  remote: {
    path: 'mytestmodel'
  }
})

beforeAll(async () => {})

it('name should be visible using a getter and composable overwriting properties', () => {
  expect(testModel.getModelName()).toBe('myTestModel')
})

it('Should insert Data', async () => {
  const inserted = await testModel.remote({ token }).insert({
    data: {
      name: 'Ignacio',
      age: 29
    }
  })

  const inserted2 = await testModel.remote({ token }).insert({
    data: {
      name: 'Andres',
      age: 15
    }
  })

  expect(typeof inserted._id).toBe('string')
  expect(typeof inserted2._id).toBe('string')
})

it('Should get remote data', async () => {
  const [error, data] = await to(testModel.remote({ token }).get())

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].data.name).toBe('Ignacio')
})
/*
it('DB should get data for any local Model', async () => {
  let [error, data] = await to(
    DB.table({
      remoteConnection: {
        baseUrl: 'https://suopywgtyuabhru.form.io',
        path: 'mytestmodel',
        token: undefined
      }
    })
      .remote({ token })
      .all()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].data.name).toBe('Ignacio')
})
*/

it('select() should filter and name specific columns', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .select('data.name as Name')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }
  expect(data[0].Name).toBe('Ignacio')
})

it('pluck() should return a single array', async () => {
  const [error, data] = await to(testModel.remote({ token }).pluck('data.name'))

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0]).toBe('Ignacio')
})

it('orderBy() should order results desc', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .select('data.name as Name')
      .orderBy('Name', 'desc')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].Name).toBe('Ignacio')
})

it('orderBy() should order results asc', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .select('data.name as Name')
      .orderBy('Name', 'asc')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].Name).toBe('Andres')
})

it('orderBy() should order by Dates with Select()', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .select('data.name as Name', 'created as created')
      .orderBy('created', 'asc')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }
  expect(data[0].Name).toBe('Ignacio')
})

it('orderBy() should order by Dates without Select()', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .orderBy('created', 'asc')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].data.name).toBe('Ignacio')
})

it('limit() should limit the amount of results', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .select('data.name as Name', 'created as created')
      .orderBy('created', 'asc', 'date')
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
      .remote({ token })
      .select('data.name as Name', 'created as created')
      .orderBy('created', 'desc')
      .limit(1)
      .offset(1)
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].Name).toBe('Andres')
})

it('where() should filter the data', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .where('data.name', '=', 'Andres')
      .select('data.name as Name', 'created as created')
      .get()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data[0].Name).toBe('Andres')
})

it('first() should take the first result from data', async () => {
  const [error, data] = await to(
    testModel
      .remote({ token })
      .where('data.name', '=', 'Ignacio')
      .select('data.name as Name', 'created as created')
      .first()
  )

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data.Name).toBe('Ignacio')
})

it('collect() should return the data as collection', async () => {
  ;[collectError, collectData] = await to(testModel.remote({ token }).collect())

  if (collectError) {
    console.log(collectError)
    throw new Error('Cannot get remote Model')
  }
})

it('avg() should calculate avg on an obj attribute', () => {
  const avg = collectData.avg('data.age')

  expect(avg).toBe(22)
})

/*
it('chunks() and collapse() an array', () => {
  var chunk = collectData.chunks(3).get()

  expect(chunk.length).toBe(1)
})
*/

it('clear() should remove all records from the Model', async () => {
  const [error, data] = await to(testModel.remote({ token }).clear({ sure: true }))

  if (error) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  const [error1, data1] = await to(
    testModel
      .remote({ token })
      .select('_id')
      .get()
  )

  if (error1) {
    console.log(error)
    throw new Error('Cannot get remote Model')
  }

  expect(data1.length).toBe(0)
})
