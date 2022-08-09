// npx jest -i src/Providers/Firebase/firebaseConnector.spec.ts
import { Fluent } from '@goatlab/fluent'
import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { GoatRepository } from './goat.repository'
import { basicTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/basicTestSuite'
import { advancedTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/advancedTestSuite'
import { relationsTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/relationsTestsSuite'

import { FirebaseInit } from '../FirebaseInit'
import { TypeOrmRepository } from './typeOrm.repository'
import { UserRepository } from './user.repository'
import { CarsRepository } from './car.repository'
import { RoleRepository } from './roles.repository'
jest.setTimeout(3 * 60 * 1000)

const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT

const serviceAccount = JSON.parse(
  Buffer.from(FIREBASE_SERVICE_ACCOUNT!, 'base64').toString('utf8')
)

beforeAll(async () => {
  await FirebaseInit({
    databaseName: 'fluent-f1d4a',
    serviceAccount
  })
  await Fluent.initialize([], dbEntities)
})

afterAll(async () => {
  // Clean all repositories
  const repositories = [
    GoatRepository,
    TypeOrmRepository,
    UserRepository,
    CarsRepository,
    RoleRepository
  ]

  for (const repo of repositories) {
    const r = new repo()
    await r.clear()
  }
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced', () => {
  advancedTestSuite(TypeOrmRepository)
})

describe('Execute all relations test suite', () => {
  relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
})
