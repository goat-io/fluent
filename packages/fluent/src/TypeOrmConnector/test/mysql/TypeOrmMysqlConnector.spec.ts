// npx jest -i ./src/TypeOrmConnector/test/mysql/TypeOrmMysqlConnector.spec.ts

import { GoatRepository } from '../basic/goat.mysql.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.mysql.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import getDatabase from '../docker/mysql'
import { MYSQLDataSource } from './mysqlDataSource'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { UserRepository } from './user.mysql.repository'
import { CarsRepository } from './car.mysql.repository'
import { RoleRepository } from './roles.mysql.repository'
import { relationsTestSuite } from '../relations/relationsTestsSuite'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let tearDown: () => Promise<void>

beforeAll(async () => {
  const { databaseURL, kill } = await getDatabase()

  tearDown = kill

  // MYSQLDataSource.setOptions({port: 3307})
  await Fluent.initialize([MYSQLDataSource], dbEntities)
})

afterAll(async () => {
  await tearDown()
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
