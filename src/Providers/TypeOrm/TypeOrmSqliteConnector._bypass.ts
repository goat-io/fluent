import { CarsEntity } from '../test/relations/car/car.entity'
import { CarsRepository } from '../test/relations/car/car.repositoryTypeOrm'
import { GoatEntity } from '../test/basic/goat.entity'
import { GoatRepository } from '../test/basic/goat.repository'
import { RoleEntity } from '../test/relations/roles/roles.entity'
import { RoleRepository } from '../test/relations/roles/roles.repositoryTypeOrm'
import { RolesUser } from '../test/relations/roles/roles_user.entity'
import { TypeORMDataModel } from '../test/advanced/typeOrm.entity'
import { TypeOrmRepository } from '../test/advanced/typeOrm.repository'
import { UserRepository } from '../test/relations/user/user.repositoryTypeOrm'
import { UsersEntity } from '../test/relations/user/user.entity'
import { advancedTestSuite } from '../test/advanced/advancedTestSuite'
import { basicTestSuite } from '../test/basic/basicTestSuite'
import { createConnection } from 'typeorm'
import { relationsTestSuite } from '../test/relations/relationsTestsSuite'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

beforeAll(async done => {
  await createConnection({
    name: 'runningTest',
    type: 'sqlite',
    database: ':memory:',
    entities: [
      GoatEntity,
      TypeORMDataModel,
      CarsEntity,
      UsersEntity,
      RoleEntity,
      RolesUser
    ],
    logging: false,
    synchronize: true
  })

  done()
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