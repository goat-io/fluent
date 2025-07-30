import 'reflect-metadata'
import { Fluent } from '@goatlab/fluent'
import { dbEntities } from '@goatlab/fluent/src/TypeOrmConnector/test/dbEntities'
import { beforeAll } from 'vitest'

// Initialize Fluent before any tests run
// This runs in the same process as the tests
beforeAll(async () => {
  await Fluent.initialize([], dbEntities)
})
