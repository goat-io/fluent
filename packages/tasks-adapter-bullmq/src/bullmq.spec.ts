// npx vitest run ./src/bullmq.spec.ts

import type { ShouldQueue } from '@goatlab/tasks-core'
import {
  multiTenantTestSuite,
  taskConnectorTestSuite,
} from '@goatlab/tasks-core/test-suite'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

// Create connector instance
const globalData = getGlobalData()
const bullmqConnector = new BullMQConnector({
  connection: {
    host: globalData.host || 'localhost',
    port: globalData.port || 6379,
  },
})

// Run the standardized test suite
taskConnectorTestSuite(
  { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
  () => bullmqConnector,
  {
    taskCompletionTimeout: 10000,
    statusCheckInterval: 500,
    runLifecycleTests: true,
    startWorker: async (tasks: ShouldQueue[]) => {
      // Start a worker for all the provided tasks
      await bullmqConnector.startWorker({
        workerName: 'test-suite-worker',
        tasks,
        concurrency: 10,
      })
      return async () => {
        await bullmqConnector.close()
      }
    },
    cleanup: async () => {
      await bullmqConnector.close()
    },
  },
)

// Additional BullMQ-specific tests
describe('BullMQConnector Specific Tests', () => {
  let connector: BullMQConnector

  beforeAll(async () => {
    connector = new BullMQConnector({
      connection: {
        host: globalData.host || 'localhost',
        port: globalData.port || 6379,
      },
    })
  })

  afterAll(async () => {
    await connector.close()
  })

  it('should get job counts for a queue', async () => {
    const counts = await connector.getJobCounts('test_specific_queue')

    expect(counts).toHaveProperty('waiting')
    expect(counts).toHaveProperty('active')
    expect(counts).toHaveProperty('completed')
    expect(counts).toHaveProperty('failed')
    expect(counts).toHaveProperty('delayed')
  })

  it('should add a job directly to a queue', async () => {
    const job = await connector.addJob('direct_queue', 'direct_job', {
      data: 'test',
    })

    expect(job).toHaveProperty('id')
    expect(job).toHaveProperty('name', 'direct_job')
    expect(job.data).toEqual({ data: 'test' })
  })

  it('should get a job by id', async () => {
    const job = await connector.addJob('get_job_queue', 'get_job_test', {
      value: 123,
    })

    const retrievedJob = await connector.getJob('get_job_queue', job.id!)

    expect(retrievedJob).toBeDefined()
    expect(retrievedJob?.data).toEqual({ value: 123 })
  })

  it('should remove a job', async () => {
    const job = await connector.addJob('remove_job_queue', 'remove_job_test', {
      toRemove: true,
    })

    await connector.removeJob('remove_job_queue', job.id!)

    const removedJob = await connector.getJob('remove_job_queue', job.id!)
    expect(removedJob).toBeUndefined()
  })

  it('should pause and resume a queue', async () => {
    await connector.pauseQueue('pause_test_queue')
    // Queue should be paused

    await connector.resumeQueue('pause_test_queue')
    // Queue should be resumed
  })

  it('should expose tenantId when set', () => {
    const tenantConnector = new BullMQConnector({
      connection: {
        host: globalData.host || 'localhost',
        port: globalData.port || 6379,
      },
      tenantId: 'test-tenant',
    })

    expect(tenantConnector.tenantId).toBe('test-tenant')
    expect(tenantConnector.prefix).toBe('test-tenant:bull')
  })

  it('should use default prefix when no tenantId', () => {
    expect(connector.tenantId).toBeUndefined()
    expect(connector.prefix).toBe('bull')
  })

  it('forTenant() should create a new connector with tenant prefix', () => {
    const tenantConnector = connector.forTenant('acme-corp')

    expect(tenantConnector.tenantId).toBe('acme-corp')
    expect(tenantConnector.prefix).toBe('acme-corp:bull')
    // Original connector should be unchanged
    expect(connector.tenantId).toBeUndefined()
  })

  it('forTenant() should support credentials for Redis ACL', () => {
    const tenantConnector = connector.forTenant('acme-corp', {
      username: 'tenant_acme',
      password: 'secret123',
    })

    expect(tenantConnector.tenantId).toBe('acme-corp')
    // Credentials are stored internally in connectionOptions
  })

  it('should wrap prefix in {} hash tags when redisInstance is a Cluster', () => {
    // Mock a Cluster instance (has .nodes() method)
    const fakeCluster = { nodes: () => [] } as any

    const clusterConnector = new BullMQConnector({
      redisInstance: fakeCluster,
      tenantId: 'tenant:acme',
    })

    expect(clusterConnector.prefix).toBe('{tenant:acme:bull}')
  })

  it('should wrap explicit prefix in {} hash tags when redisInstance is a Cluster', () => {
    const fakeCluster = { nodes: () => [] } as any

    const clusterConnector = new BullMQConnector({
      redisInstance: fakeCluster,
      prefix: 'tenant:sodium-platform:dispatch',
    })

    expect(clusterConnector.prefix).toBe('{tenant:sodium-platform:dispatch}')
  })

  it('should NOT wrap prefix when redisInstance is standalone Redis (no .nodes())', () => {
    const fakeRedis = {} as any

    const standaloneConnector = new BullMQConnector({
      redisInstance: fakeRedis,
      tenantId: 'tenant:acme',
    })

    expect(standaloneConnector.prefix).toBe('tenant:acme:bull')
  })

  it('should NOT double-wrap prefix already containing {}', () => {
    const fakeCluster = { nodes: () => [] } as any

    const clusterConnector = new BullMQConnector({
      redisInstance: fakeCluster,
      prefix: '{already-wrapped}',
    })

    expect(clusterConnector.prefix).toBe('{already-wrapped}')
  })

  it('forTenant() should preserve cluster hash tag wrapping', () => {
    const fakeCluster = { nodes: () => [] } as any

    const baseCluster = new BullMQConnector({
      redisInstance: fakeCluster,
      tenantId: 'base',
    })

    const tenantConnector = baseCluster.forTenant('tenant:acme')
    expect(tenantConnector.prefix).toBe('{tenant:acme:bull}')
  })
})

// Multi-tenant isolation tests
// These verify that different tenants using the same Redis instance are properly isolated
const baseConnector = new BullMQConnector({
  connection: {
    host: globalData.host || 'localhost',
    port: globalData.port || 6379,
  },
})

// Store tenant connectors for cleanup
const tenantConnectors: Map<string, BullMQConnector> = new Map()

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
        concurrency: 10,
      })
      return async () => {
        await tenantConnector.close()
      }
    },
    taskCompletionTimeout: 10000,
    statusCheckInterval: 500,
    workerStartupDelay: 2000,
    supportsForTenant: true,
    runIsolationTests: true,
    cleanup: async () => {
      for (const connector of tenantConnectors.values()) {
        await connector.close()
      }
      tenantConnectors.clear()
      await baseConnector.close()
    },
  },
)
