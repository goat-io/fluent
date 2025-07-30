import 'reflect-metadata'
import { afterAll, beforeAll, describe } from 'vitest'
import { initialize } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { MySQLTestContainer } from '../testcontainers/mysql.testcontainer'
import { unifiedTestSuite } from '../unified/unifiedTestSuite'

describe('MySQL Tests with Unified Suite', () => {
  let container: MySQLTestContainer
  let dataSource: any

  beforeAll(async () => {
    container = new MySQLTestContainer()
    dataSource = await container.start()
    await initialize([dataSource], dbEntities)
  }, 60000)

  afterAll(async () => {
    await container.stop()
  })

  // Call the test suite after the describe block setup
  describe('Tests', () => {
    beforeAll(() => {
      if (!dataSource) {
        throw new Error('DataSource not initialized')
      }
    })

    unifiedTestSuite({ dataSource: () => dataSource, dbType: 'mysql' })
  })
})
