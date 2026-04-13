import 'reflect-metadata'
import { createUnifiedTests } from '@goatlab/fluent'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteFirebaseApps, FirebaseInit } from '../FirebaseInit'
import { GoatRepository } from './goat.repository'
import { TypeOrmRepository } from './typeOrm.repository'

describe('Firebase Connector Tests with Generic Unified Suite', () => {
  beforeAll(async () => {
    // Initialize Firebase with emulator settings
    FirebaseInit({
      databaseName: 'test-project',
      emulator: true,
    })
  })

  const unifiedTests = createUnifiedTests({
    createGoatConnector: () => new GoatRepository(),
    createTypeOrmConnector: () => new TypeOrmRepository(),
    dbType: 'firebase',
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
