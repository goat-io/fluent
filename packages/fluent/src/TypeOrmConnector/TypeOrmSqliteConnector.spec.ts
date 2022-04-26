// npx jest -i ./src/Providers/TypeOrm/TypeOrmSqliteConnector.spec.ts
import { CarsRepository } from './test/relations/car/car.repositoryTypeOrm'
import { GoatRepository } from './test/basic/goat.repository'
import { RoleRepository } from './test/relations/roles/roles.repositoryTypeOrm'
import { TypeOrmRepository } from './test/advanced/typeOrm.repository'
import { UserRepository } from './test/relations/user/user.repositoryTypeOrm'
import { advancedTestSuite } from './test/advanced/advancedTestSuite'
import { basicTestSuite } from './test/basic/basicTestSuite'
import { relationsTestSuite } from './test/relations/relationsTestsSuite'
import { Fluent } from '../index'
import { dbEntities } from './test/dbEntities'
import { MemoryDataSource } from './test/memoryDataSource'

jest.setTimeout(600000)

beforeAll(async done => {
  await Fluent.initialize([MemoryDataSource], dbEntities)
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
