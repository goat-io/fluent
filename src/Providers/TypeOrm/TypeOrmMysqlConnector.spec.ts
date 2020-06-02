import { TypeOrmConnector } from './TypeOrmConnector'
import { createConnection } from 'typeorm'
import getDatabase from '@databases/mysql-test'

import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
import { flock } from '../test/flock'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let GoatModel: TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>
let storedId: any
let tearDown: any

beforeAll(async done => {
  const { databaseURL, kill } = await getDatabase()
  tearDown = kill
  const connection = await createConnection({
    type: 'mysql',
    database: 'test-db',
    username: 'test-user',
    password: 'password',
    port: 3306,
    entities: [GoatEntity],
    synchronize: true,
    logging: false
  })

  const repository = connection.getRepository(GoatEntity)

  GoatModel = new TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>({
    repository,
    isRelationalDB: true
  })
  done()
})

afterAll(() => {
  return tearDown()
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
})
