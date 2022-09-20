// npx jest -i ./src/TypeOrmConnector/test/mongo/TypeOrmMongoConnector.spec.ts
import { GoatRepository } from '../basic/goat.mongo.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.mongo.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { MongoDataSource } from './mongoDatasource'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
import { UserRepository } from './user.mongo.repository'
import { CarsRepository } from './car.mongo.repository'
import { RoleRepository } from './roles.mongo.repository'
import getDatabase from '../docker/mongo'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

// let mongoConnection: MongoMemoryServer
let tearDown: () => Promise<void>

beforeAll(async () => {
  const { kill, port, databaseURL } = await getDatabase()
  tearDown = kill
  // mongoConnection = await mongoMemory.start()
  MongoDataSource.setOptions({
    url: databaseURL,
    entities: dbEntities
  })
  await Fluent.initialize([MongoDataSource], dbEntities)
})

afterAll(async () => {
  tearDown && (await tearDown())
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
