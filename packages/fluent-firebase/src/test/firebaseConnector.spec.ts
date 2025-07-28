import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createUnifiedTests, Fluent } from '@goatlab/fluent'
import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { FirebaseInit, deleteFirebaseApps } from '../FirebaseInit'

import { TypeOrmRepository } from './typeOrm.repository'
import { GoatRepository } from './goat.repository'

describe('Firebase Connector Tests with Generic Unified Suite', () => {
  const unifiedTests = createUnifiedTests({
    createGoatConnector: () => new GoatRepository(),
    createTypeOrmConnector: () => new TypeOrmRepository(),
    dbType: 'firebase'
  })

  beforeAll(async () => {
    // Initialize Firebase with emulator settings
    FirebaseInit({
      databaseName: 'test-project',
      emulator: true
    })

    // Initialize Fluent with entities to ensure metadata is available
    // Firebase doesn't use TypeORM datasources, so we pass empty array
    await Fluent.initialize([], dbEntities)
  })

  afterAll(async () => {
    // Clean up Firebase connection if needed
    await deleteFirebaseApps()
  })

  describe('Basic Tests', () => {
    unifiedTests.runBasicTests(describe, it, expect, beforeAll, beforeEach)
  })

  describe('Advanced Tests', () => {
    unifiedTests.runAdvancedTests(describe, it, expect, beforeAll, beforeEach)
  })
})
