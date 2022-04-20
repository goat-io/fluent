// npx jest -i src/Providers/Firebase/firebaseConnector.spec.ts

import { CarsEntity } from './test/relations/car/car.entity'
import { CarsRepository } from './test/relations/car/car.repositoryFirebase'
import { FirebaseRepository } from './test/advanced/firebase.repository'
import { Fluent } from '@goatlab/fluent'
import { GoatEntity } from './test/basic/goat.entity'
import { GoatEntityRepository } from './test/goat.repository'
import { RoleEntity } from './test/relations/roles/roles.entity'
import { RoleRepository } from './test/relations/roles/roles.repositoryFirebase'
import { RolesUser } from './test/relations/roles/roles_user.entity'
import { TypeORMDataModel } from './test/advanced/typeOrm.entity'
import { UserRepository } from './test/relations/user/user.repositoryFirebase'
import { UsersEntity } from './test/relations/user/user.entity'
import { advancedTestSuite } from './test/advanced/advancedTestSuite'
import { basicTestSuite } from './test/basic/basicTestSuite'
import { relationsTestSuite } from './test/relations/relationsTestsSuite'

jest.setTimeout(3 * 60 * 1000)

beforeAll(async () => {
  await Fluent.initialize([],[
    GoatEntity,
    TypeORMDataModel,
    CarsEntity,
    UsersEntity,
    RoleEntity,
    RolesUser
  ])
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatEntityRepository)
})

describe('Execute all advanced', () => {
  advancedTestSuite(FirebaseRepository)
})

describe('Execute all relations test suite', () => {
  relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
