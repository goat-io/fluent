import 'reflect-metadata'
import { afterAll, beforeAll, describe } from 'vitest'
import { initialize } from '../../../Fluent'
import { dbEntities } from '../dbEntities'
import { MongoDBTestContainer } from '../testcontainers/mongodb.testcontainer'
import { unifiedTestSuite } from '../unified/unifiedTestSuite'

describe('MongoDB Tests with Unified Suite', () => {
  let container: MongoDBTestContainer
  let dataSource: any

  beforeAll(async () => {
    container = new MongoDBTestContainer()
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

    unifiedTestSuite({ dataSource: () => dataSource, dbType: 'mongodb' })
  })
})
