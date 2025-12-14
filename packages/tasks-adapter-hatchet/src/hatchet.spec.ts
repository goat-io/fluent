// npx vitest run ./src/hatchet.spec.ts

import { ShouldQueue } from '@goatlab/tasks-core'
import { taskConnectorTestSuite } from '@goatlab/tasks-core/test-suite'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { HatchetConnector } from './HatchetConnector.js'
import { getGlobalData } from './test/const.js'

// Create connector instance
const globalData = getGlobalData()
const hatchetConnector = new HatchetConnector({
  logLevel: 'DEBUG',
  token: globalData.token || process.env.HATCHET_JWT_TOKEN || '',
  hostAndPort: globalData.hostAndPort,
  apiUrl: globalData.apiUrl
})

// Run the standardized test suite
// Hatchet requires all workflows to be registered before any queue() calls
taskConnectorTestSuite(
  { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
  () => hatchetConnector,
  {
    taskCompletionTimeout: 20000,
    statusCheckInterval: 1000,
    workerStartupDelay: 25000,
    startWorker: async (tasks: ShouldQueue[]) => {
      await hatchetConnector.startWorker({
        workerName: 'test-suite-worker',
        tasks,
        slots: 100
      })
      return async () => {}
    }
  }
)
