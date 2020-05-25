import { TypeOrmConnector } from './TypeOrmConnector'
import { createConnection } from 'typeorm'
import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
import { flock } from '../test/flock'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let GoatModel: TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>

beforeAll(async done => {
  const connection = await createConnection({
    type: 'sqlite',
    database: './src/Providers/TypeOrm/test.db',
    entities: [GoatEntity],
    logging: false,
    synchronize: true
  })

  const repository = connection.getRepository(GoatEntity)

  GoatModel = new TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>({
    repository
  })
  done()
})

afterAll(async () => {
  await GoatModel.clear({ sure: true })
})

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  expect(Array.isArray(storedGoats)).toBe(true)
})

test('Insert - Should  insert data', async () => {
  const a = await GoatModel.insert({ name: 'myGoat', age: 13 })
  expect(typeof a._id).toBe('string')
  expect(a.name).toBe('myGoat')
  expect(0).toBe(0)
})

it('Create Multiple - Should insert Multiple elements', async () => {
  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
})

it('UpdateById - Should Update a single element', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.get()
  const data = await GoatModel.updateById(goats[0]._id, {
    age: 99,
    name: 'MyUpdatedGoat'
  })
  expect(data.name).toBe('MyUpdatedGoat')
})

it('Where - Should Filter elements', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.where(GoatModel._keys.name, '=', 'A').get()
  expect(typeof goats).toBe('object')
  expect(goats[0].name).toBe('A')
})

it('Where - Should Filter multiple Where clauses', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.where(GoatModel._keys.name, 'regexp', '%a%')
    .andWhere(GoatModel._keys.age, '>', 3)
    .get()
  expect(typeof goats).toBe('object')
  expect(goats[0].age > 3).toBe(true)
})

it('OrWhere - Should Filter multiple Where clauses', async () => {
  await GoatModel.insertMany(flock)

  const goats = await GoatModel.where(GoatModel._keys.age, '<', 3)
    .orWhere(GoatModel._keys.age, '>', 30)
    .get()

  expect(typeof goats).toBe('object')
  expect(goats[0].age > 3).toBe(true)
})
