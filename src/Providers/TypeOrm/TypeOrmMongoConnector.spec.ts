import { TypeOrmConnector } from './TypeOrmConnector'
import { createConnection } from 'typeorm'
import { mongoMemory } from '../../Database/mongo.memory'
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000
import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
import { flock } from '../test/flock'

import { advancedTestSuite, TypeORMDataModel } from '../test/advancedTestSuite'

let GoatModel: TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>
let AdvanceModel: TypeOrmConnector<TypeORMDataModel>
let storedId: any

beforeAll(async done => {
  const a = await mongoMemory.start()

  const connection = await createConnection({
    type: 'mongodb',
    url: a.url,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    entities: [GoatEntity, TypeORMDataModel],
    synchronize: true,
    logging: false
  })

  const repository = connection.getRepository(GoatEntity)

  GoatModel = new TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>({
    repository
  })

  const advancedRepo = connection.getRepository(TypeORMDataModel)

  AdvanceModel = new TypeOrmConnector<TypeORMDataModel>({
    repository: advancedRepo
  })

  done()
})

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  expect(Array.isArray(storedGoats)).toBe(true)
})

test('Insert - Should  insert data', async () => {
  const a = await GoatModel.insert({ name: 'myGoat', age: 13 })
  expect(typeof a.id).toBe('string')
  expect(a.name).toBe('myGoat')
  expect(0).toBe(0)
})

it('Create Multiple - Should insert Multiple elements', async () => {
  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0].id
})

it('UpdateById - Should Update a single element', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.get()

  const data = await GoatModel.updateById(goats[0].id, {
    age: 99,
    name: 'MyUpdatedGoat'
  })
  expect(data.name).toBe('MyUpdatedGoat')

  const data2 = await GoatModel.updateById(goats[0].id, {
    age: 99,
    name: 'MyUpdatedGoat2'
  })
  expect(data2.name).toBe('MyUpdatedGoat2')
})
