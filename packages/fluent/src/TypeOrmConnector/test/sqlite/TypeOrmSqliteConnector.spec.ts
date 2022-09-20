// npx jest -i ./src/TypeOrmConnector/test/sqlite/TypeOrmSqliteConnector.spec.ts
import { GoatRepository } from '../basic/goat.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { Fluent } from '../../../index'
import { dbEntities } from '../dbEntities'
import { MemoryDataSource } from './memoryDataSource'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
import { UserRepository } from '../relations/user/user.repositoryTypeOrm'
import { CarsRepository } from '../relations/car/car.repositoryTypeOrm'
import { RoleRepository } from '../relations/roles/roles.repositoryTypeOrm'

jest.setTimeout(600000)

beforeAll(async () => {
  await Fluent.initialize([MemoryDataSource], dbEntities)
})

const userRepo = new UserRepository()
describe('Loading test', () => {
  it('Should run even when initialized in the same file', async () => {
    const a = await userRepo.findMany()

    expect(Array.isArray(a)).toBe(true)
  })
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
