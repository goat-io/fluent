import { CarsEntity } from '../../Providers/test/relations/car.entity'
import { Fluent } from '../../Fluent'
import { GoatEntity } from '../test/basic/goat.entity'
import { GoatEntityRepository } from './goat.repository'
import { TypeORMDataModel } from '../test/advanced/typeOrm.entity'
import { TypeOrmRepository } from './typeOrm.repository'
import { UserRepository } from '../test/relations/user.repository'
import { UsersEntity } from '../../Providers/test/relations/user.entity'
import { advancedTestSuite } from '../test/advanced/advancedTestSuite'
import { basicTestSuite } from '../test/basic/basicTestSuite'
import { relationsTestSuite } from '../test/relations/relationsTestsSuite'

jest.setTimeout(3 * 60 * 1000)

beforeAll(async () => {
  await Fluent.start([GoatEntity, TypeORMDataModel, CarsEntity, UsersEntity])
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatEntityRepository)
})

describe('Execute all advanced', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  relationsTestSuite(UserRepository)
})
