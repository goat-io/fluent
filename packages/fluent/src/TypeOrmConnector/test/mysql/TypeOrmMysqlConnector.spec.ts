// npx vitest run ./src/TypeOrmConnector/test/mysql/TypeOrmMysqlConnector.spec.ts

import 'reflect-metadata'
import { describe, beforeAll, afterAll } from 'vitest'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { MySQLTestContainer } from '../testcontainers/mysql.testcontainer'
import { Fluent } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { DataSource } from 'typeorm'

let container: MySQLTestContainer
let dataSource: DataSource

describe('MySQL Tests with Testcontainers', () => {
  beforeAll(async () => {
    container = new MySQLTestContainer()
    dataSource = await container.start()
    
    // Initialize Fluent with entities for model generator
    await Fluent.initialize([dataSource], dbEntities)
  }, 60000) // Increase timeout for container startup

  afterAll(async () => {
    await container.stop()
  })

  describe('Execute all basic test Suite', () => {
    basicTestSuite(() => dataSource)
  })

  describe('Execute all advanced test Suite', () => {
    advancedTestSuite(() => dataSource)
  })
})

// describe('Execute all relations test suite', () => {
//   relationsTestSuite(UserRepository, CarsRepository, RoleRepository)
// })
