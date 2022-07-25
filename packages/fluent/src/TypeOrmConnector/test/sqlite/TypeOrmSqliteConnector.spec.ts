// npx jest -i ./src/Providers/TypeOrm/TypeOrmSqliteConnector.spec.ts
import { CarsRepository } from '../relations/car/car.repositoryTypeOrm'
import { GoatRepository } from '../basic/goat.repository'
import { RoleRepository } from '../relations/roles/roles.repositoryTypeOrm'
import { TypeOrmRepository } from '../advanced/typeOrm.repository'
import { UserRepository } from '../relations/user/user.repositoryTypeOrm'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
import { Fluent } from '../../../index'
import { dbEntities } from '../dbEntities'
import { MemoryDataSource } from './memoryDataSource'

jest.setTimeout(600000)

beforeAll(async () => {
  await Fluent.initialize([MemoryDataSource], dbEntities)
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  //relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
