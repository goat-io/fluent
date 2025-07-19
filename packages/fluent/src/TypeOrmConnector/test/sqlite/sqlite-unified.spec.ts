import 'reflect-metadata'
import { describe, beforeAll } from 'vitest'
import { Fluent } from '../../../index'
import { dbEntities } from '../dbEntities'
import { MemoryDataSource } from './memoryDataSource'
import { unifiedTestSuite } from '../unified/unifiedTestSuite'

describe('SQLite Tests with Unified Suite', () => {
  let dataSource: any

  beforeAll(async () => {
    dataSource = MemoryDataSource
    await Fluent.initialize([dataSource], dbEntities)
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