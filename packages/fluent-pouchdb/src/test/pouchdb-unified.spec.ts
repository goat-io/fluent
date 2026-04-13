import 'reflect-metadata'
import { createUnifiedTests } from '@goatlab/fluent'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  PouchDBGoatRepositoryFactory,
  PouchDBTypeOrmRepositoryFactory,
} from './pouchdb.repository.factory'

describe('PouchDB Connector - Unified Tests', () => {
  const unifiedTests = createUnifiedTests({
    createGoatConnector: () => new PouchDBGoatRepositoryFactory(),
    createTypeOrmConnector: () => new PouchDBTypeOrmRepositoryFactory(),
    dbType: 'pouchdb',
  })

  describe('Basic Tests', () => {
    unifiedTests.runBasicTests(describe, it, expect, beforeAll, beforeEach)
  })

  describe('Advanced Tests', () => {
    unifiedTests.runAdvancedTests(describe, it, expect, beforeAll, beforeEach)
  })
})
