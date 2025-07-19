// npx vitest run ./src/TypeOrmConnector/test/postgresql/TypeOrmPostgresqlConnector.spec.ts

import 'reflect-metadata'
import { describe, beforeAll, afterAll } from 'vitest'
import { advancedTestSuite } from '../testcontainer/advancedTestSuite'
import { basicTestSuite } from '../testcontainer/basicTestSuite'
import { PostgreSQLTestContainer } from '../testcontainers/postgresql.testcontainer'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { DataSource } from 'typeorm'

let container: PostgreSQLTestContainer
let dataSource: DataSource

beforeAll(async () => {
  container = new PostgreSQLTestContainer()
  dataSource = await container.start()
  
  // Initialize Fluent with entities for model generator
  await Fluent.initialize([dataSource], dbEntities)
}, 60000) // Increase timeout for container startup

afterAll(async () => {
  await container.stop()
})

describe('Execute all basic test Suite', () => {
  basicTestSuite(dataSource)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(dataSource)
})