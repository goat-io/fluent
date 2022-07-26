import { GoatRepository } from '../basic/goat.mongo.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.mongo.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { mongoMemory } from './mongo.memory'
import { MongoDataSource } from './mongoDatasource'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { MongoMemoryServer } from 'mongodb-memory-server'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let mongoConnection: MongoMemoryServer

beforeAll(async () => {
  mongoConnection = await mongoMemory.start()
  MongoDataSource.setOptions({
    url: mongoConnection.getUri(),
    entities: dbEntities
  })
  await Fluent.initialize([MongoDataSource], dbEntities)
})

afterAll(async () => {
  await mongoConnection.stop()
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  // relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
