import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities';
import { Fluent } from '@goatlab/fluent'
import { basicTestSuite } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/basicTestSuite'
import { GoatRepository } from './goat.loki.repository'

beforeAll(async() => {
  await Fluent.initialize([], dbEntities)
})
describe('Execute all basic test Suite', () => {
  basicTestSuite(GoatRepository)
})

describe('Execute all advanced test Suite', () => {
  // advancedTestSuite(Goat2)
})
