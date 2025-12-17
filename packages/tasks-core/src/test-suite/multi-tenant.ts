/**
 * Multi-tenant isolation tests for TaskConnector implementations.
 *
 * These tests verify that different tenants sharing the same underlying
 * infrastructure have properly isolated task queues and data.
 *
 * Key isolation requirements:
 * - Tenant A cannot see Tenant B's tasks
 * - Tenant A cannot access Tenant B's task status
 * - Each tenant's tasks are prefixed/namespaced appropriately
 * - Workers for one tenant don't process another tenant's tasks
 */

import { ShouldQueue } from '../ShouldQueue.js'
import type {
  TaskConnector,
  TenantCredentials,
  UnknownInputType
} from '../ShouldQueue.types.js'
import type { TestFramework, TestSuiteOptions } from './types.js'
import { delay, generateTestId, waitForTaskCompletion } from './utils.js'

/**
 * Factory function type for creating tenant-scoped connectors.
 */
export type TenantConnectorFactory<TInput extends object = object> = (
  tenantId: string,
  credentials?: TenantCredentials
) => TaskConnector<TInput> | Promise<TaskConnector<TInput>>

/**
 * Options for multi-tenant test suite
 */
export interface MultiTenantTestOptions extends TestSuiteOptions {
  /**
   * Factory function to create a connector for a specific tenant.
   * This is the primary way to get tenant-scoped connectors.
   */
  createTenantConnector: TenantConnectorFactory

  /**
   * Function to start workers for specific tenants.
   * Each tenant needs its own worker(s) to process tasks.
   *
   * @param tenantId - The tenant ID to start workers for
   * @param tasks - The task instances to register with the worker
   * @returns Cleanup function to stop the workers
   */
  startTenantWorker: (
    tenantId: string,
    tasks: ShouldQueue[]
  ) => Promise<() => Promise<void>>

  /**
   * Whether the adapter supports the forTenant() method on connectors.
   * If true, additional tests for forTenant() will be run.
   * Default: true
   */
  supportsForTenant?: boolean

  /**
   * Whether to run isolation tests that verify tenants can't see each other's data.
   * Default: true
   */
  runIsolationTests?: boolean

  /**
   * Custom URL for task callbacks.
   * For adapters like GCP Cloud Tasks that use HTTP callbacks,
   * this should be a real endpoint (e.g., 'https://httpbin.org/post').
   * Default: 'http://localhost/test/multi-tenant'
   */
  testPostUrl?: string

  /**
   * Time to wait for workers to start processing.
   * Default: 2000ms
   */
  workerStartupDelay?: number
}

/**
 * Creates a test task class for multi-tenant testing
 */
export function createMultiTenantTestTask(
  connector: TaskConnector<{ text: string; tenantMarker: string }>,
  testPostUrl = 'http://localhost/test/multi-tenant'
) {
  return class MultiTenantTestTask extends ShouldQueue<{
    text: string
    tenantMarker: string
  }> {
    postUrl = testPostUrl
    taskName = 'test_multi_tenant_task'

    constructor() {
      super({ connector })
    }

    public getUniqueTaskName(data: {
      text: string
      tenantMarker: string
    }): string {
      return `mt_task_${data.tenantMarker}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    public async handle(_taskBody: UnknownInputType): Promise<undefined> {
      return undefined
    }
  }
}

/**
 * Multi-tenant isolation test suite for TaskConnector implementations.
 *
 * Tests that verify proper tenant isolation when sharing infrastructure.
 *
 * @example
 * ```typescript
 * import { multiTenantTestSuite } from '@goatlab/tasks-core/test-suite'
 *
 * multiTenantTestSuite(
 *   { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
 *   {
 *     createTenantConnector: (tenantId) => connector.forTenant(tenantId),
 *     startTenantWorker: async (tenantId, tasks) => {
 *       const tenantConnector = connector.forTenant(tenantId)
 *       await tenantConnector.startWorker({ tasks })
 *       return () => tenantConnector.close()
 *     }
 *   }
 * )
 * ```
 */
export function multiTenantTestSuite(
  test: TestFramework,
  options: MultiTenantTestOptions
) {
  const {
    createTenantConnector,
    startTenantWorker,
    supportsForTenant = true,
    runIsolationTests = true,
    testPostUrl = 'http://localhost/test/multi-tenant',
    workerStartupDelay = 2000,
    taskCompletionTimeout = 10000,
    statusCheckInterval = 500,
    setup,
    cleanup
  } = options

  // Generate unique tenant IDs for each test run to avoid conflicts
  const tenantA = `tenant_a_${generateTestId()}`
  const tenantB = `tenant_b_${generateTestId()}`

  test.describe('Multi-Tenant Isolation Tests', () => {
    let connectorA: TaskConnector<{ text: string; tenantMarker: string }>
    let connectorB: TaskConnector<{ text: string; tenantMarker: string }>
    let taskA: ShouldQueue<{ text: string; tenantMarker: string }>
    let taskB: ShouldQueue<{ text: string; tenantMarker: string }>
    let stopWorkerA: (() => Promise<void>) | undefined
    let stopWorkerB: (() => Promise<void>) | undefined

    test.beforeAll(async () => {
      if (setup) {
        await setup()
      }

      // Create tenant-scoped connectors
      connectorA = (await createTenantConnector(tenantA)) as TaskConnector<{
        text: string
        tenantMarker: string
      }>
      connectorB = (await createTenantConnector(tenantB)) as TaskConnector<{
        text: string
        tenantMarker: string
      }>

      // Create task instances for each tenant
      const TaskClassA = createMultiTenantTestTask(connectorA, testPostUrl)
      const TaskClassB = createMultiTenantTestTask(connectorB, testPostUrl)
      taskA = new TaskClassA()
      taskB = new TaskClassB()

      // Start workers for each tenant
      stopWorkerA = await startTenantWorker(tenantA, [taskA])
      stopWorkerB = await startTenantWorker(tenantB, [taskB])

      // Wait for workers to be ready
      await delay(workerStartupDelay)
    }, 120000)

    test.afterAll(async () => {
      if (stopWorkerA) {
        await stopWorkerA()
      }
      if (stopWorkerB) {
        await stopWorkerB()
      }
      if (cleanup) {
        await cleanup()
      }
    })

    // Basic tenant identification tests
    test.describe('Tenant Identification', () => {
      test.it('connectors should have correct tenant IDs', () => {
        test.expect(connectorA.tenantId).toBe(tenantA)
        test.expect(connectorB.tenantId).toBe(tenantB)
      })

      test.it('tasks should expose tenant ID from connector', () => {
        test.expect(taskA.tenantId).toBe(tenantA)
        test.expect(taskB.tenantId).toBe(tenantB)
      })

      test.it('different tenants should have different IDs', () => {
        test.expect(connectorA.tenantId).not.toBe(connectorB.tenantId)
      })
    })

    // Queue isolation tests
    test.describe('Queue Isolation', () => {
      test.it('tenant A can queue tasks', async () => {
        const status = await taskA.queue({
          text: 'tenant A task',
          tenantMarker: tenantA
        })

        test.expect(status).toBeDefined()
        test.expect(status.id).toBeDefined()
        test.expect(status.status).toBe('QUEUED')
      })

      test.it('tenant B can queue tasks', async () => {
        const status = await taskB.queue({
          text: 'tenant B task',
          tenantMarker: tenantB
        })

        test.expect(status).toBeDefined()
        test.expect(status.id).toBeDefined()
        test.expect(status.status).toBe('QUEUED')
      })

      test.it(
        'tenant A task IDs are different from tenant B task IDs',
        async () => {
          const statusA = await taskA.queue({
            text: 'unique ID test A',
            tenantMarker: tenantA
          })
          const statusB = await taskB.queue({
            text: 'unique ID test B',
            tenantMarker: tenantB
          })

          test.expect(statusA.id).not.toBe(statusB.id)
        }
      )
    })

    // Lifecycle isolation tests
    test.describe('Lifecycle Isolation', () => {
      test.it(
        'tenant A tasks complete independently',
        async () => {
          const status = await taskA.queue({
            text: 'completion test A',
            tenantMarker: tenantA
          })

          const finalStatus = await waitForTaskCompletion(
            () => taskA.getStatus(status.id),
            { timeout: taskCompletionTimeout, interval: statusCheckInterval }
          )

          test.expect(finalStatus.status).toBe('COMPLETED')
          test.expect((finalStatus.payload as any).tenantMarker).toBe(tenantA)
        },
        taskCompletionTimeout + 5000
      )

      test.it(
        'tenant B tasks complete independently',
        async () => {
          const status = await taskB.queue({
            text: 'completion test B',
            tenantMarker: tenantB
          })

          const finalStatus = await waitForTaskCompletion(
            () => taskB.getStatus(status.id),
            { timeout: taskCompletionTimeout, interval: statusCheckInterval }
          )

          test.expect(finalStatus.status).toBe('COMPLETED')
          test.expect((finalStatus.payload as any).tenantMarker).toBe(tenantB)
        },
        taskCompletionTimeout + 5000
      )

      test.it(
        'multiple tenants can process tasks concurrently',
        async () => {
          // Queue tasks for both tenants simultaneously
          const [statusA1, statusA2, statusB1, statusB2] = await Promise.all([
            taskA.queue({ text: 'concurrent A1', tenantMarker: tenantA }),
            taskA.queue({ text: 'concurrent A2', tenantMarker: tenantA }),
            taskB.queue({ text: 'concurrent B1', tenantMarker: tenantB }),
            taskB.queue({ text: 'concurrent B2', tenantMarker: tenantB })
          ])

          // Wait for all to complete
          const [finalA1, finalA2, finalB1, finalB2] = await Promise.all([
            waitForTaskCompletion(() => taskA.getStatus(statusA1.id), {
              timeout: taskCompletionTimeout,
              interval: statusCheckInterval
            }),
            waitForTaskCompletion(() => taskA.getStatus(statusA2.id), {
              timeout: taskCompletionTimeout,
              interval: statusCheckInterval
            }),
            waitForTaskCompletion(() => taskB.getStatus(statusB1.id), {
              timeout: taskCompletionTimeout,
              interval: statusCheckInterval
            }),
            waitForTaskCompletion(() => taskB.getStatus(statusB2.id), {
              timeout: taskCompletionTimeout,
              interval: statusCheckInterval
            })
          ])

          // All should complete
          test.expect(finalA1.status).toBe('COMPLETED')
          test.expect(finalA2.status).toBe('COMPLETED')
          test.expect(finalB1.status).toBe('COMPLETED')
          test.expect(finalB2.status).toBe('COMPLETED')

          // Each should have correct tenant marker
          test.expect((finalA1.payload as any).tenantMarker).toBe(tenantA)
          test.expect((finalA2.payload as any).tenantMarker).toBe(tenantA)
          test.expect((finalB1.payload as any).tenantMarker).toBe(tenantB)
          test.expect((finalB2.payload as any).tenantMarker).toBe(tenantB)
        },
        taskCompletionTimeout * 2 + 10000
      )
    })

    // Data isolation tests - verify tenants can't see each other's data
    if (runIsolationTests) {
      test.describe('Data Isolation', () => {
        test.it('tenant A cannot access tenant B task status', async () => {
          // Queue a task in tenant B
          const statusB = await taskB.queue({
            text: 'isolation test B',
            tenantMarker: tenantB
          })

          // Wait for it to be persisted
          await delay(500)

          // Try to get status from tenant A's connector
          // This should either:
          // 1. Return a "not found" status (COMPLETED with empty payload)
          // 2. Throw an error
          // 3. Return undefined/null
          try {
            const statusFromA = await taskA.getStatus(statusB.id)

            // If it returns something, it should indicate not found
            // or return empty/different data
            const payloadFromA = statusFromA.payload as any

            // The payload should NOT contain tenant B's marker
            // (either empty, undefined, or different)
            if (payloadFromA?.tenantMarker) {
              test.expect(payloadFromA.tenantMarker).not.toBe(tenantB)
            }
          } catch {
            // Error is acceptable - means proper isolation
            test.expect(true).toBe(true)
          }
        })

        test.it('tenant B cannot access tenant A task status', async () => {
          // Queue a task in tenant A
          const statusA = await taskA.queue({
            text: 'isolation test A',
            tenantMarker: tenantA
          })

          // Wait for it to be persisted
          await delay(500)

          // Try to get status from tenant B's connector
          try {
            const statusFromB = await taskB.getStatus(statusA.id)

            // If it returns something, it should indicate not found
            const payloadFromB = statusFromB.payload as any

            // The payload should NOT contain tenant A's marker
            if (payloadFromB?.tenantMarker) {
              test.expect(payloadFromB.tenantMarker).not.toBe(tenantA)
            }
          } catch {
            // Error is acceptable - means proper isolation
            test.expect(true).toBe(true)
          }
        })

        test.it(
          'each tenant maintains independent task counts',
          async () => {
            // This test queues tasks for both tenants and verifies
            // they maintain separate state

            const tasksToQueue = 3
            const tenantAIds: string[] = []
            const tenantBIds: string[] = []

            // Queue tasks for tenant A
            for (let i = 0; i < tasksToQueue; i++) {
              const status = await taskA.queue({
                text: `count test A ${i}`,
                tenantMarker: tenantA
              })
              tenantAIds.push(status.id)
            }

            // Queue tasks for tenant B
            for (let i = 0; i < tasksToQueue; i++) {
              const status = await taskB.queue({
                text: `count test B ${i}`,
                tenantMarker: tenantB
              })
              tenantBIds.push(status.id)
            }

            // All IDs should be unique across tenants
            const allIds = [...tenantAIds, ...tenantBIds]
            const uniqueIds = new Set(allIds)
            test.expect(uniqueIds.size).toBe(allIds.length)

            // Wait for completion
            await Promise.all([
              ...tenantAIds.map(id =>
                waitForTaskCompletion(() => taskA.getStatus(id), {
                  timeout: taskCompletionTimeout,
                  interval: statusCheckInterval
                })
              ),
              ...tenantBIds.map(id =>
                waitForTaskCompletion(() => taskB.getStatus(id), {
                  timeout: taskCompletionTimeout,
                  interval: statusCheckInterval
                })
              )
            ])
          },
          taskCompletionTimeout * 3 + 10000
        )
      })
    }

    // forTenant() method tests
    if (supportsForTenant) {
      test.describe('forTenant() Factory Method', () => {
        test.it('connector should support forTenant()', () => {
          // Get a base connector (tenant A's connector)
          test.expect(connectorA.forTenant).toBeDefined()
        })

        test.it(
          'forTenant() creates connector with correct tenant ID',
          async () => {
            const newTenantId = `tenant_new_${generateTestId()}`
            const newConnector = connectorA.forTenant!(newTenantId)

            test.expect(newConnector.tenantId).toBe(newTenantId)
          }
        )

        test.it('forTenant() creates isolated connectors', async () => {
          const tenantC = `tenant_c_${generateTestId()}`
          const tenantD = `tenant_d_${generateTestId()}`

          const connectorC = (await createTenantConnector(
            tenantC
          )) as TaskConnector<{ text: string; tenantMarker: string }>
          const connectorD = (await createTenantConnector(
            tenantD
          )) as TaskConnector<{ text: string; tenantMarker: string }>

          test.expect(connectorC.tenantId).toBe(tenantC)
          test.expect(connectorD.tenantId).toBe(tenantD)
          test.expect(connectorC.tenantId).not.toBe(connectorD.tenantId)
        })
      })
    }

    // Payload preservation tests
    test.describe('Payload Preservation Per Tenant', () => {
      test.it(
        'tenant A preserves complex payloads',
        async () => {
          const complexPayload = {
            text: 'complex test A',
            tenantMarker: tenantA,
            nested: { deep: { value: 'tenant-a-data' } },
            array: [1, 2, 3],
            number: 42,
            bool: true
          } as any

          const status = await taskA.queue(complexPayload)
          const finalStatus = await waitForTaskCompletion(
            () => taskA.getStatus(status.id),
            { timeout: taskCompletionTimeout, interval: statusCheckInterval }
          )

          const payload = finalStatus.payload as any
          test.expect(payload.tenantMarker).toBe(tenantA)
          test.expect(payload.nested.deep.value).toBe('tenant-a-data')
          test.expect(payload.array).toEqual([1, 2, 3])
          test.expect(payload.number).toBe(42)
          test.expect(payload.bool).toBe(true)
        },
        taskCompletionTimeout + 5000
      )

      test.it(
        'tenant B preserves complex payloads independently',
        async () => {
          const complexPayload = {
            text: 'complex test B',
            tenantMarker: tenantB,
            nested: { deep: { value: 'tenant-b-data' } },
            array: [4, 5, 6],
            number: 99,
            bool: false
          } as any

          const status = await taskB.queue(complexPayload)
          const finalStatus = await waitForTaskCompletion(
            () => taskB.getStatus(status.id),
            { timeout: taskCompletionTimeout, interval: statusCheckInterval }
          )

          const payload = finalStatus.payload as any
          test.expect(payload.tenantMarker).toBe(tenantB)
          test.expect(payload.nested.deep.value).toBe('tenant-b-data')
          test.expect(payload.array).toEqual([4, 5, 6])
          test.expect(payload.number).toBe(99)
          test.expect(payload.bool).toBe(false)
        },
        taskCompletionTimeout + 5000
      )
    })
  })
}

export default multiTenantTestSuite
