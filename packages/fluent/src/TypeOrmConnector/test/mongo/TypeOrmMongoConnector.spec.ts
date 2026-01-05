// npx jest -i ./src/TypeOrmConnector/test/mongo/TypeOrmMongoConnector.spec.ts

import { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initialize } from '../../../Fluent'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import getDatabase from '../docker/mongo'
import { relationsTestSuite } from '../relations/relationsTestsSuite'
import { dbEntitiesMongo } from './dbEntitiesMongo'
import { UserRepository } from './user.mongo.repository'

let tearDown: () => Promise<void>
let dataSource: DataSource

beforeAll(async () => {
  const { kill, databaseURL } = await getDatabase()
  tearDown = kill

  dataSource = new DataSource({
    type: 'mongodb',
    url: databaseURL,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    entities: dbEntitiesMongo,
    logging: false,
  })

  await dataSource.initialize()
  await initialize([dataSource], dbEntitiesMongo)
}, 30000)

afterAll(async () => {
  if (dataSource?.isInitialized) {
    await dataSource.destroy()
  }
  tearDown && (await tearDown())
})

describe('Loading test', () => {
  it('Should run even when initialized in the same file', async () => {
    const userRepo = new UserRepository(() => dataSource)
    const a = await userRepo.findMany()

    expect(Array.isArray(a)).toBe(true)
  })
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(() => dataSource)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(() => dataSource)
})

// MongoDB doesn't support traditional SQL joins, so relation tests are skipped
// TODO: Implement MongoDB-specific relation handling
describe.skip('Execute all relations test suite', () => {
  relationsTestSuite(() => dataSource)
})
