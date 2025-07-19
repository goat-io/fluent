// npx vitest run ./src/TypeOrmConnector/test/mongodb/TypeOrmMongodbConnector.spec.ts

import 'reflect-metadata'
import { describe, beforeAll, afterAll } from 'vitest'
import { advancedTestSuite } from '../testcontainer/advancedTestSuite'
import { basicTestSuite } from '../testcontainer/basicTestSuite'
import { MongoDBTestContainer } from '../testcontainers/mongodb.testcontainer'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { DataSource } from 'typeorm'

let container: MongoDBTestContainer
let dataSource: DataSource

beforeAll(async () => {
  container = new MongoDBTestContainer()
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