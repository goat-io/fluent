import { DataSource } from 'typeorm'
import { CarsEntity } from '../relations/car/car.entity'
import { CarsRepository } from '../relations/car/car.repositoryTypeOrm'
import { GoatEntity } from '../basic/goat.entity'
import { GoatRepository } from '../basic/goat.mysql.repository'
import { RoleEntity } from '../relations/roles/roles.entity'
import { RoleRepository } from '../relations/roles/roles.repositoryTypeOrm'
import { RolesUser } from '../relations/roles/roles_user.entity'
import { TypeORMDataModel } from '../advanced/typeOrm.entity'
import { TypeOrmRepository } from '../advanced/typeOrm.mysql.repository'
import { UserRepository } from '../relations/user/user.repositoryTypeOrm'
import { UsersEntity } from '../relations/user/user.entity'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import getDatabase from '../docker/mysql'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
import {MYSQLDataSource} from './mysqlDataSource'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let tearDown: () => Promise<void>

beforeAll(async () => {
  const {databaseURL, kill} = await getDatabase()
  
  tearDown = kill

  // MYSQLDataSource.setOptions({port: 3307}) 
  await Fluent.initialize([MYSQLDataSource], dbEntities)
})

afterAll(async() => {
  await tearDown()
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
  // expect(true).toBe(false)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  //relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
