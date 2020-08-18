import { CarsEntity } from '../test/relations/car.entity'
import { GoatEntity } from '../test/basic/goat.entity'
import { GoatRepository } from '../test/basic/goat.repository'
import { TypeORMDataModel } from '../test/advanced/typeOrm.entity'
import { TypeOrmRepository } from '../test/advanced/typeOrm.repository'
import { UserRepository } from '../test/relations/user.repositoryTypeOrm'
import { UsersEntity } from '../test/relations/user.entity'
import { advancedTestSuite } from '../test/advanced/advancedTestSuite'
import { basicTestSuite } from '../test/basic/basicTestSuite'
import { createConnection } from 'typeorm'
import { mongoMemory } from '../../Database/mongo.memory'
import { relationsTestSuite } from '../test/relations/relationsTestsSuite'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let mongoConnection

beforeAll(async done => {
  process.env = Object.assign(process.env, { MAIN_DATABASE_TYPE: true })
  mongoConnection = await mongoMemory.start()
  await createConnection({
    type: 'mongodb',
    name: 'runningTest',
    url: mongoConnection.url,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    entities: [GoatEntity, TypeORMDataModel, CarsEntity, UsersEntity],
    synchronize: true,
    logging: false
  })

  done()
})

afterAll(async () => {
  await mongoConnection.instance.stop()
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  relationsTestSuite(UserRepository)
})
