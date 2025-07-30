// npx jest -i ./src/TypeOrmConnector/test/sqlite/TypeOrmSqliteConnector.spec.ts
import { beforeAll, describe, expect, it } from 'vitest'
import { initialize } from '../../../index'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { GoatRepository } from '../basic/goat.repository'
import { dbEntities } from '../dbEntities'
import { MemoryDataSource } from './memoryDataSource'

// import { UserRepository } from '../relations/user/user.repositoryTypeOrm'
// import { CarsRepository } from '../relations/car/car.repositoryTypeOrm'
// import { RoleRepository } from '../relations/roles/roles.repositoryTypeOrm'

beforeAll(async () => {
  await initialize([MemoryDataSource], dbEntities)
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
