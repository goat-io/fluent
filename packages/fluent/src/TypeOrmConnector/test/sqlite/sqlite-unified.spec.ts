import 'reflect-metadata'
import { beforeAll, describe } from 'vitest'
import { initialize } from '../../../index'
import { dbEntities } from '../dbEntities'
import { unifiedTestSuite } from '../unified/unifiedTestSuite'
import { MemoryDataSource } from './memoryDataSource'

describe('SQLite Tests with Unified Suite', () => {
  let dataSource: any

  beforeAll(async () => {
    dataSource = MemoryDataSource
    await initialize([dataSource], dbEntities)
  })

  describe('Tests', () => {
    beforeAll(() => {
      if (!dataSource) {
        throw new Error('DataSource not initialized')
      }
    })

    unifiedTestSuite({ dataSource: () => dataSource, dbType: 'sqlite' })
  })
})
