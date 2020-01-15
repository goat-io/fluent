import { Fluent } from './Fluent'
import { MemoryConnector } from './Providers/Memory/MemoryConnector'

const testConnector = {
  name: 'testConnector',
  baseUrl: 'https://ydrahgggqviwquft.form.io/',
  connector: MemoryConnector
}

Fluent.config({
  LOCAL_CONNECTORS: [testConnector],
  MERGE_CONNECTORS: [testConnector],
  REMOTE_CONNECTORS: [testConnector]
})

const Mymodel = Fluent.model({
  properties: {
    name: 'Mymodel'
  }
})()

it('name should be Private', () => {
  expect(Mymodel.name).toBe(undefined)
})

it('name should be visible using a getter and composable overwriting properties', () => {
  expect(Mymodel.getModelName()).toBe('Mymodel')
})

test('Should  get remote connector', async () => {
  const model = await Mymodel.remote().get()
  expect(Array.isArray(model)).toBe(true)
  expect(model.length).toBe(0)
})

it('Should insert Data', async () => {
  const inserted = await Mymodel.remote().insert({
    data: {
      age: 29,
      name: 'Ignacio'
    }
  })

  const inserted2 = await Mymodel.remote().insert({
    data: {
      age: 15,
      name: 'Andres'
    }
  })

  expect(typeof inserted._id).toBe('string')
  expect(typeof inserted2._id).toBe('string')
})

it('Should get remote data', async () => {
  const data = await Mymodel.remote().get()
  expect(data[0].data.name).toBe('Ignacio')
})
