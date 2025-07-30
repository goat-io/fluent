// npx vitest run ./src/TypeOrmConnector/test/mysql/TypeOrmMysqlConnector.spec.ts

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe } from 'vitest'
import { initialize } from '../../../Fluent'
import { advancedTestSuite } from '../advanced/advancedTestSuite'
import { basicTestSuite } from '../basic/basicTestSuite'
import { dbEntities } from '../dbEntities'
import { MySQLTestContainer } from '../testcontainers/mysql.testcontainer'

let container: MySQLTestContainer
let dataSource: DataSource

describe('MySQL Tests with Testcontainers', () => {
  beforeAll(async () => {
    container = new MySQLTestContainer()
    dataSource = await container.start()

    // Initialize Fluent with entities for model generator
    await initialize([dataSource], dbEntities)
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
