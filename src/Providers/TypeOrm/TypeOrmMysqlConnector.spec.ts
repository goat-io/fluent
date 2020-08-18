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
import getDatabase from '@databases/mysql-test'
import { relationsTestSuite } from '../test/relations/relationsTestsSuite'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let tearDown: any

beforeAll(async done => {
  const { databaseURL, kill } = await getDatabase()
  tearDown = kill
  await createConnection({
    type: 'mysql',
    name: 'runningTest',
    database: 'mySchema',
    username: 'root',
    password: 'secret',
    port: 3306,
    entities: [GoatEntity, TypeORMDataModel, CarsEntity, UsersEntity],
    synchronize: true,
    logging: false
  })

  done()
})

afterAll(() => {
  return tearDown()
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
