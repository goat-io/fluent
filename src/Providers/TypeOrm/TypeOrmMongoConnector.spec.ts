import { TypeOrmConnector } from './TypeOrmConnector'
import { createConnection } from 'typeorm'
import { mongoMemory } from '../../Database/mongo.memory'
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000
import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
import { flock } from '../test/flock'

let GoatModel: TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>
let storedId: any

beforeAll(async done => {
  const a = await mongoMemory.start()

  const connection = await createConnection({
    type: 'mongodb',
    url: a.url,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    entities: [GoatEntity],
    synchronize: true,
    logging: false
  })

  const repository = connection.getRepository(GoatEntity)

  GoatModel = new TypeOrmConnector<GoatEntity, GoatEntityIn, GoatEntityOut>({
    repository
  })
  done()
})

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  expect(Array.isArray(storedGoats)).toBe(true)
})

test('Insert - Should  insert data', async () => {
  const a = await GoatModel.insert({ name: 'myGoat', age: 13 })
  expect(typeof a._id).toBe('object')
  expect(a.name).toBe('myGoat')
  expect(0).toBe(0)
})

it('Create Multiple - Should insert Multiple elements', async () => {
  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0]._id
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
