// npx jest -i ./src/TypeOrmConnector/test/sqlite/TypeOrmSqliteConnector.spec.ts
import { describe, beforeAll, it, expect } from 'vitest'
import { GoatRepository } from '../basic/goat.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { Fluent } from '../../../index'
import { dbEntities } from '../dbEntities'
import { MemoryDataSource } from './memoryDataSource'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
// import { UserRepository } from '../relations/user/user.repositoryTypeOrm'
// import { CarsRepository } from '../relations/car/car.repositoryTypeOrm'
// import { RoleRepository } from '../relations/roles/roles.repositoryTypeOrm'

beforeAll(async () => {
  await Fluent.initialize([MemoryDataSource], dbEntities)
})

const goatRepo = new GoatRepository()
describe('Loading test', () => {
  it('Should run even when initialized in the same file', async () => {
    const a = await goatRepo.findMany()

    expect(Array.isArray(a)).toBe(true)
  })
})

describe('Execute all basic test Suite', () => {
  basicTestSuite()
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite()
})

// describe('Execute all relations test suite', () => {
//   relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
// })
