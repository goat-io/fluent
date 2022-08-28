// npx jest -i ./src/test/LokiConnector.spec.ts

import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { Fluent } from '@goatlab/fluent'
import { basicTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/basicTestSuite'
import { advancedTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/advancedTestSuite'
import { GoatRepository } from './goat.loki.repository'
import { TypeOrmRepository } from './typeorm.loki.repository'

beforeAll(async () => {
  await Fluent.initialize([], dbEntities)
})
describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(TypeOrmRepository)
})
