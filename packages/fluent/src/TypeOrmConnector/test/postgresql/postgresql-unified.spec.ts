import 'reflect-metadata'
import { afterAll, beforeAll, describe } from 'vitest'
import { initialize } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { PostgreSQLTestContainer } from '../testcontainers/postgresql.testcontainer'
import { unifiedTestSuite } from '../unified/unifiedTestSuite'

describe('PostgreSQL Tests with Unified Suite', () => {
  let container: PostgreSQLTestContainer
  let dataSource: any

  beforeAll(async () => {
    container = new PostgreSQLTestContainer()
    dataSource = await container.start()
    await initialize([dataSource], dbEntities)
  }, 60000)

  afterAll(async () => {
    await container.stop()
  })

  describe('Tests', () => {
    beforeAll(() => {
      if (!dataSource) {
        throw new Error('DataSource not initialized')
      }
    })

    unifiedTestSuite({ dataSource: () => dataSource, dbType: 'postgresql' })
  })
})
