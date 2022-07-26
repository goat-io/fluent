// npx jest -i ./src/Providers/TypeOrm/TypeOrmSqliteConnector.spec.ts
import { GoatRepository } from '../basic/goat.repository'
import { TypeOrmRepository } from '../advanced/typeOrm.repository'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
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
