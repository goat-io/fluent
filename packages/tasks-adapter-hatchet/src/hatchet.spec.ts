// npx vitest run ./src/hatchet.spec.ts

import type { ShouldQueue } from '@goatlab/tasks-core'
import {
  multiTenantTestSuite,
  taskConnectorTestSuite
} from '@goatlab/tasks-core/test-suite'
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

// Hatchet-specific tests
describe('HatchetConnector Specific Tests', () => {
  it('should expose tenantId when set', () => {
    const tenantConnector = new HatchetConnector({
      token: globalData.token || process.env.HATCHET_JWT_TOKEN || '',
      hostAndPort: globalData.hostAndPort,
      apiUrl: globalData.apiUrl,
      logLevel: 'OFF',
      tenantId: 'test-tenant'
    })

    expect(tenantConnector.tenantId).toBe('test-tenant')
    expect(tenantConnector.namespace).toBe('test-tenant')
  })

  it('should have undefined tenantId when not set', () => {
    expect(hatchetConnector.tenantId).toBeUndefined()
    expect(hatchetConnector.namespace).toBe('')
  })

  it('forTenant() should create a new connector with tenant namespace', () => {
    const tenantConnector = hatchetConnector.forTenant('acme-corp')

    expect(tenantConnector.tenantId).toBe('acme-corp')
    expect(tenantConnector.namespace).toBe('acme-corp')
    // Original connector should be unchanged
    expect(hatchetConnector.tenantId).toBeUndefined()
  })
})

// Multi-tenant isolation tests using Hatchet namespaces
// These verify that different tenants using the same Hatchet instance are properly isolated
const baseConnector = new HatchetConnector({
  token: globalData.token || process.env.HATCHET_JWT_TOKEN || '',
  hostAndPort: globalData.hostAndPort,
  apiUrl: globalData.apiUrl,
  logLevel: 'DEBUG'
})

// Store tenant connectors for cleanup
const tenantConnectors: Map<string, HatchetConnector> = new Map()

multiTenantTestSuite(
  { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
  {
    createTenantConnector: tenantId => {
      const tenantConnector = baseConnector.forTenant(tenantId)
      tenantConnectors.set(tenantId, tenantConnector)
      return tenantConnector
    },
    startTenantWorker: async (tenantId, tasks: ShouldQueue[]) => {
      const tenantConnector = tenantConnectors.get(tenantId)
      if (!tenantConnector) {
        throw new Error(`Tenant connector not found for ${tenantId}`)
      }
      await tenantConnector.startWorker({
        workerName: `tenant-${tenantId}-worker`,
        tasks,
        slots: 100
      })
      return async () => {
        // Hatchet workers don't have a close method
      }
    },
    taskCompletionTimeout: 20000,
    statusCheckInterval: 1000,
    workerStartupDelay: 25000,
    supportsForTenant: true,
    runIsolationTests: true
  }
)
