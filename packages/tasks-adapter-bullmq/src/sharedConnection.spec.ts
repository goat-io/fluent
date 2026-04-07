/**
 * Multi-tenant shared connection tests.
 *
 * Uses a real Redis testcontainer (started by setup.ts globalSetup).
 *
 * Simulates a realistic multi-tenant platform where:
 * - Multiple tenants share a single Redis instance
 * - Each tenant has multiple task queues (email, posts, notifications, etc.)
 * - Jobs are enqueued via tenant-scoped connectors
 * - Jobs are processed via processIncomingDispatch (on-demand, no persistent workers)
 *
 * Verifies O(1) Redis connections regardless of tenant/queue count.
 *
 * Run: npx vitest run ./src/sharedConnection.spec.ts
 */

import IORedis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

const globalData = getGlobalData()
const REDIS_HOST = globalData.host || 'localhost'
const REDIS_PORT = globalData.port || 6379
const TEST_RUN = `test:mt:${Date.now()}`

// ---------------------------------------------------------------------------
// Realistic task queues (simulates what a SaaS platform would register)
// ---------------------------------------------------------------------------
const TASK_QUEUES = [
  'process_post',
  'send_email',
  'notify_dispatch',
  'index_search',
  'generate_thumbnail',
  'process_payment',
  'sync_analytics',
  'broadcast_config',
] as const

const TENANT_IDS = [
  'acme-corp',
  'globex',
  'initech',
  'umbrella',
  'stark-ind',
  'wayne-ent',
  'oscorp',
  'lexcorp',
  'daily-planet',
  'capsule-corp',
] as const

/** Count connected Redis clients via CLIENT LIST */
async function countClients(redis: IORedis): Promise<number> {
  const list = await redis.client('LIST')
  return (list as string).split('\n').filter(l => l.trim()).length
}

describe('Multi-Tenant Shared Connection', () => {
  let monitor: IORedis

  beforeAll(async () => {
    monitor = new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
    })
    await monitor.ping()
  })

  afterAll(async () => {
    monitor.disconnect()
  })

  it('10 tenants x 8 queues = 80 Queue instances should use O(1) connections', async () => {
    const clientsBefore = await countClients(monitor)

    const platform = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
      },
      prefix: `${TEST_RUN}:platform`,
    })

    const tenantConnectors: BullMQConnector[] = []

    for (const tenantId of TENANT_IDS) {
      const tc = platform.forTenant(tenantId)
      tenantConnectors.push(tc)

      for (const queue of TASK_QUEUES) {
        await tc.addJob(queue, `${queue}-job`, {
          tenantId,
          queue,
          payload: `data for ${tenantId}/${queue}`,
        })
      }
    }

    await new Promise(r => setTimeout(r, 500))
    const clientsAfter = await countClients(monitor)
    const newConns = clientsAfter - clientsBefore

    console.log(
      `[O(1) Test] ${TENANT_IDS.length} tenants x ${TASK_QUEUES.length} queues ` +
        `= ${TENANT_IDS.length * TASK_QUEUES.length} Queue instances → ` +
        `${newConns} new Redis connections`,
    )

    // O(1): should be 1-3, NOT 80
    expect(newConns).toBeLessThanOrEqual(5)

    // Verify jobs were enqueued with correct per-tenant isolation
    for (const tc of tenantConnectors) {
      for (const queue of TASK_QUEUES) {
        const counts = await tc.getJobCounts(queue)
        expect(counts.waiting).toBe(1)
      }
    }

    for (const tc of tenantConnectors) {
      await tc.close()
    }
    await platform.close()
  }, 30_000)

  it('processIncomingDispatch respects tenant isolation', async () => {
    const platform = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
      },
      prefix: `${TEST_RUN}:isolation`,
    })

    const tenants = ['tenant-a', 'tenant-b', 'tenant-c']
    const connectors = tenants.map(t => platform.forTenant(t))

    // Each tenant enqueues 1 job to process_post
    for (let i = 0; i < tenants.length; i++) {
      await connectors[i].addJob('process_post', 'post-job', {
        content: `Post from ${tenants[i]}`,
      })
    }

    // Process ONLY tenant-b
    const processed: unknown[] = []
    const result = await connectors[1].processIncomingDispatch({
      handleTask: async (_queue, data) => {
        processed.push(data)
        return { ok: true }
      },
      timeBudgetMs: 5_000,
      validQueueNames: new Set(['process_post']),
    })

    expect(result.processed).toBe(1)
    expect(processed).toHaveLength(1)
    expect((processed[0] as any).content).toBe('Post from tenant-b')

    // Other tenants' jobs untouched
    expect((await connectors[0].getJobCounts('process_post')).waiting).toBe(1)
    expect((await connectors[2].getJobCounts('process_post')).waiting).toBe(1)

    for (const c of connectors) {
      await c.close()
    }
    await platform.close()
  }, 15_000)

  it('full dispatch cycle: 5 tenants x 3 queues, enqueue + process', async () => {
    const clientsBefore = await countClients(monitor)

    const platform = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
      },
      prefix: `${TEST_RUN}:fullcycle`,
    })

    const tenants = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']
    const queues = ['send_email', 'process_payment', 'sync_analytics']
    const connectors = tenants.map(t => platform.forTenant(t))

    // Enqueue 3 jobs per tenant
    for (let i = 0; i < tenants.length; i++) {
      for (const q of queues) {
        await connectors[i].addJob(q, `${q}-job`, {
          tenant: tenants[i],
          type: q,
        })
      }
    }

    // Process each tenant independently (simulating dispatch endpoint)
    const allResults: { tenant: string; processed: number }[] = []
    for (let i = 0; i < tenants.length; i++) {
      const r = await connectors[i].processIncomingDispatch({
        handleTask: async () => ({ done: true }),
        timeBudgetMs: 5_000,
        validQueueNames: new Set(queues),
      })
      allResults.push({ tenant: tenants[i], processed: r.processed })
    }

    // Each tenant processed exactly 3 jobs
    for (const r of allResults) {
      expect(r.processed).toBe(3)
    }

    // Connections still O(1)
    await new Promise(r => setTimeout(r, 300))
    const clientsAfter = await countClients(monitor)
    const newConns = clientsAfter - clientsBefore

    console.log(
      `[Full Cycle] 5 tenants x 3 queues, enqueue + dispatch → ` +
        `${newConns} Redis connections`,
    )
    expect(newConns).toBeLessThanOrEqual(5)

    for (const c of connectors) {
      await c.close()
    }
    await platform.close()
  }, 30_000)

  it('empty dispatch across 8 queues uses shared connection', async () => {
    const clientsBefore = await countClients(monitor)

    const platform = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
      },
      prefix: `${TEST_RUN}:empty`,
    })

    const tc = platform.forTenant('ghost-tenant')

    const result = await tc.processIncomingDispatch({
      handleTask: async () => ({ ok: true }),
      timeBudgetMs: 3_000,
      validQueueNames: new Set(TASK_QUEUES as unknown as string[]),
    })

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)

    await new Promise(r => setTimeout(r, 200))
    const clientsAfter = await countClients(monitor)
    const newConns = clientsAfter - clientsBefore

    console.log(`[Empty Dispatch] 8 queues scanned → ${newConns} connections`)
    expect(newConns).toBeLessThanOrEqual(3)

    await tc.close()
    await platform.close()
  }, 15_000)
})
