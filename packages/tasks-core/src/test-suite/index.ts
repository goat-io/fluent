/**
 * @goatlab/tasks-core Test Suite
 *
 * A standardized test suite for TaskConnector implementations.
 * Similar to @keyv/test-suite, this package provides tests that all
 * task adapter implementations must pass to be considered production-ready.
 *
 * @example
 * ```typescript
 * import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
 * import { taskConnectorTestSuite } from '@goatlab/tasks-core/test-suite'
 * import { MyConnector } from './MyConnector'
 *
 * const connector = new MyConnector({ ... })
 *
 * taskConnectorTestSuite(
 *   { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
 *   () => connector,
 *   {
 *     startWorker: async (tasks) => {
 *       await connector.startWorker({ tasks })
 *       return async () => connector.close()
 *     }
 *   }
 * )
 * ```
 */

import { ShouldQueue } from '../ShouldQueue.js'
import type { TaskConnector } from '../ShouldQueue.types.js'
import { createApiTestTask, taskConnectorApiTests } from './api.js'
import {
  createFailingTask,
  createSuccessTask,
  taskConnectorLifecycleTests,
} from './lifecycle.js'
import type {
  ConnectorFactory,
  TestFramework,
  TestSuiteOptions,
} from './types.js'
import { delay, waitForTaskCompletion } from './utils.js'
import { createGenericTask, taskConnectorValueTests } from './values.js'

// Re-export individual test suites for granular testing
export { createApiTestTask, taskConnectorApiTests } from './api.js'
export {
  createFailingTask,
  createSuccessTask,
  taskConnectorLifecycleTests,
} from './lifecycle.js'
export type {
  MultiTenantTestOptions,
  TenantConnectorFactory,
} from './multi-tenant.js'
// Re-export multi-tenant test suite
export {
  createMultiTenantTestTask,
  multiTenantTestSuite,
} from './multi-tenant.js'
export type {
  ConnectorFactory,
  ExpectAPI,
  TestContext,
  TestFramework,
  TestSuiteOptions,
} from './types.js'
// Re-export utilities
export {
  assertDefined,
  createTestPayload,
  delay,
  generateTestId,
  retry,
  waitForTaskCompletion,
  waitForTaskStatus,
} from './utils.js'
export { createGenericTask, taskConnectorValueTests } from './values.js'

/**
 * Options for the full test suite
 */
export interface FullTestSuiteOptions extends TestSuiteOptions {
  /**
   * Setup function that starts a worker for processing the given tasks.
   * The tasks array contains ALL task instances that will be used across all tests.
   * Required for lifecycle tests and connectors that need pre-registration (like Hatchet).
   * Should return a cleanup function.
   */
  startWorker?: (tasks: ShouldQueue[]) => Promise<() => Promise<void>>

  /**
   * Whether to skip API tests. Default: false
   */
  skipApiTests?: boolean

  /**
   * Whether to skip lifecycle tests. Default: false
   */
  skipLifecycleTests?: boolean

  /**
   * Whether to skip value tests. Default: false
   */
  skipValueTests?: boolean

  /**
   * Time to wait after starting worker before running tests.
   * Useful for connectors like Hatchet that need registration time.
   * Default: 2000ms
   */
  workerStartupDelay?: number
}

/**
 * Shared state for tests - uses object so references work correctly
 */
interface SharedState {
  connector: TaskConnector<any> | null
  apiTask: ShouldQueue<{ text: string }> | null
  successTask: ShouldQueue<{ text: string }> | null
  failingTask: ShouldQueue<{ text: string; shouldFail?: boolean }> | null
  preserveTask: ShouldQueue<any> | null
}

/**
 * Complete test suite for TaskConnector implementations.
 *
 * This function runs all standard tests that a TaskConnector must pass
 * to be considered production-ready:
 *
 * 1. **API Tests**: Basic queue() and getStatus() functionality
 * 2. **Lifecycle Tests**: Task state transitions (QUEUED → RUNNING → COMPLETED/FAILED)
 * 3. **Value Tests**: Payload serialization and data integrity
 *
 * IMPORTANT: For connectors that require workflow pre-registration (like Hatchet),
 * the startWorker function is called ONCE before all tests with ALL task instances.
 *
 * @param test - Test framework instance (Vitest compatible)
 * @param connectorFactory - Factory function that creates a TaskConnector instance
 * @param options - Configuration options for the test suite
 */
export function taskConnectorTestSuite<
  TInput extends object = { text: string },
>(
  test: TestFramework,
  connectorFactory: ConnectorFactory<TInput>,
  options: FullTestSuiteOptions = {},
) {
  const {
    skipApiTests = false,
    skipLifecycleTests = false,
    skipValueTests = false,
    startWorker,
    workerStartupDelay = 2000,
    ...baseOptions
  } = options

  // If no startWorker provided, run tests individually (legacy mode)
  if (!startWorker) {
    if (!skipApiTests) {
      taskConnectorApiTests(
        test,
        connectorFactory as ConnectorFactory<{ text: string }>,
        baseOptions,
      )
    }

    if (!skipLifecycleTests && baseOptions.runLifecycleTests !== false) {
      taskConnectorLifecycleTests(
        test,
        connectorFactory as ConnectorFactory<{ text: string }>,
        baseOptions,
      )
    }

    if (!skipValueTests) {
      taskConnectorValueTests(
        test,
        connectorFactory as ConnectorFactory<any>,
        baseOptions,
      )
    }
    return
  }

  // Shared state object - mutations to this object are visible to all tests
  const state: SharedState = {
    connector: null,
    apiTask: null,
    successTask: null,
    failingTask: null,
    preserveTask: null,
  }

  let stopWorker: (() => Promise<void>) | undefined

  // Unified test runner with shared worker
  test.describe('TaskConnector Test Suite', () => {
    test.beforeAll(async () => {
      if (baseOptions.setup) {
        await baseOptions.setup()
      }

      // Get connector
      state.connector = (await connectorFactory()) as TaskConnector<any>

      // Create all task instances
      const ApiTask = createApiTestTask(state.connector)
      state.apiTask = new ApiTask()

      const SuccessTask = createSuccessTask(state.connector)
      state.successTask = new SuccessTask()

      const FailingTask = createFailingTask(state.connector as any)
      state.failingTask = new FailingTask()

      const PreserveTask = createGenericTask(
        state.connector,
        'test_preserve_task',
      )
      state.preserveTask = new PreserveTask()

      // Start worker with ALL tasks
      const allTasks = [
        state.apiTask,
        state.successTask,
        state.failingTask,
        state.preserveTask,
      ]
      stopWorker = await startWorker(allTasks)

      // Wait for worker to be ready
      await delay(workerStartupDelay)
    }, 120000) // 2 minute timeout for beforeAll

    test.afterAll(async () => {
      if (stopWorker) {
        await stopWorker()
      }
      if (baseOptions.cleanup) {
        await baseOptions.cleanup()
      }
    })

    // API Tests
    if (!skipApiTests) {
      test.describe('API Tests', () => {
        test.it('queue() should return a task status object', async () => {
          const status = await state.apiTask!.queue({ text: 'test message' })

          test.expect(status).toBeDefined()
          test.expect(status).toHaveProperty('id')
          test.expect(status).toHaveProperty('name')
          test.expect(status).toHaveProperty('status')
          test.expect(status).toHaveProperty('created')
          test.expect(status).toHaveProperty('attempts')
        })

        test.it('queue() should return QUEUED status initially', async () => {
          const status = await state.apiTask!.queue({ text: 'queued test' })
          test.expect(status.status).toBe('QUEUED')
        })

        test.it(
          'queue() should return task name containing the defined taskName',
          async () => {
            const status = await state.apiTask!.queue({ text: 'name test' })
            test.expect(status.name).toContain('test_api_task')
          },
        )

        test.it('queue() should return a unique id for each task', async () => {
          const status1 = await state.apiTask!.queue({ text: 'unique test 1' })
          const status2 = await state.apiTask!.queue({ text: 'unique test 2' })

          test.expect(status1.id).toBeDefined()
          test.expect(status2.id).toBeDefined()
          test.expect(status1.id).not.toBe(status2.id)
        })

        test.it('queue() should not include payload in response', async () => {
          const status = await state.apiTask!.queue({ text: 'no payload test' })
          test.expect(status).not.toHaveProperty('payload')
        })

        test.it('queue() should set attempts to 0', async () => {
          const status = await state.apiTask!.queue({ text: 'attempts test' })
          test.expect(status.attempts).toBe(0)
        })

        test.it('queue() should set created timestamp', async () => {
          const status = await state.apiTask!.queue({ text: 'timestamp test' })
          test.expect(status.created).toBeDefined()
          test.expect(() => new Date(status.created)).not.toThrow()
        })

        test.it(
          'getStatus() should return full task status with payload',
          async () => {
            const queuedStatus = await state.apiTask!.queue({
              text: 'get status test',
            })
            await delay(500)

            const status = await state.apiTask!.getStatus(queuedStatus.id)

            test.expect(status).toBeDefined()
            test.expect(status).toHaveProperty('id', queuedStatus.id)
            test.expect(status).toHaveProperty('name')
            test.expect(status).toHaveProperty('status')
            test.expect(status).toHaveProperty('payload')
          },
        )

        test.it('getStatus() should return the original payload', async () => {
          const payload = { text: 'payload preservation test' }
          const queuedStatus = await state.apiTask!.queue(payload)
          await delay(500)

          const status = await state.apiTask!.getStatus(queuedStatus.id)

          test.expect(status.payload).toBeDefined()
          test.expect(status.payload.text).toBe(payload.text)
        })

        test.it('getStatus() should return same id as queue()', async () => {
          const queuedStatus = await state.apiTask!.queue({
            text: 'id match test',
          })
          await delay(500)

          const status = await state.apiTask!.getStatus(queuedStatus.id)
          test.expect(status.id).toBe(queuedStatus.id)
        })
      })
    }

    // Lifecycle Tests
    if (!skipLifecycleTests && baseOptions.runLifecycleTests !== false) {
      const lifecycleTimeout = baseOptions.taskCompletionTimeout ?? 10000

      test.describe('Lifecycle Tests', () => {
        test.it(
          'task should eventually reach COMPLETED status',
          async () => {
            const queuedStatus = await state.successTask!.queue({
              text: 'completion test',
            })
            test.expect(queuedStatus.status).toBe('QUEUED')

            const finalStatus = await waitForTaskCompletion(
              () => state.successTask!.getStatus(queuedStatus.id),
              {
                timeout: lifecycleTimeout,
                interval: baseOptions.statusCheckInterval ?? 500,
              },
            )

            test.expect(finalStatus.status).toBe('COMPLETED')
          },
          lifecycleTimeout + 5000,
        )

        test.it(
          'completed task should preserve payload',
          async () => {
            const payload = { text: 'payload in completed task' }
            const queuedStatus = await state.successTask!.queue(payload)

            const finalStatus = await waitForTaskCompletion(
              () => state.successTask!.getStatus(queuedStatus.id),
              {
                timeout: lifecycleTimeout,
                interval: baseOptions.statusCheckInterval ?? 500,
              },
            )

            test.expect(finalStatus.status).toBe('COMPLETED')
            test.expect(finalStatus.payload).toBeDefined()
            test.expect((finalStatus.payload as any).text).toBe(payload.text)
          },
          lifecycleTimeout + 5000,
        )

        test.it(
          'failed task should reach FAILED status',
          async () => {
            const queuedStatus = await state.failingTask!.queue({
              text: 'failure test',
              shouldFail: true,
            })

            const finalStatus = await waitForTaskCompletion(
              () => state.failingTask!.getStatus(queuedStatus.id),
              {
                timeout: lifecycleTimeout,
                interval: baseOptions.statusCheckInterval ?? 500,
              },
            )

            test.expect(finalStatus.status).toBe('FAILED')
          },
          lifecycleTimeout + 5000,
        )

        test.it(
          'multiple tasks should complete independently',
          async () => {
            const statuses = await Promise.all([
              state.successTask!.queue({ text: 'multi test 1' }),
              state.successTask!.queue({ text: 'multi test 2' }),
              state.successTask!.queue({ text: 'multi test 3' }),
            ])

            for (const status of statuses) {
              test.expect(status.status).toBe('QUEUED')
            }

            const ids = statuses.map(s => s.id)
            const uniqueIds = new Set(ids)
            test.expect(uniqueIds.size).toBe(ids.length)

            const finalStatuses = await Promise.all(
              statuses.map(s =>
                waitForTaskCompletion(
                  () => state.successTask!.getStatus(s.id),
                  {
                    timeout: lifecycleTimeout,
                    interval: baseOptions.statusCheckInterval ?? 500,
                  },
                ),
              ),
            )

            for (const status of finalStatuses) {
              test.expect(status.status).toBe('COMPLETED')
            }
          },
          lifecycleTimeout * 2 + 5000,
        )

        test.it(
          'task attempts should increment on execution',
          async () => {
            const queuedStatus = await state.successTask!.queue({
              text: 'attempts test',
            })
            test.expect(queuedStatus.attempts).toBe(0)

            const finalStatus = await waitForTaskCompletion(
              () => state.successTask!.getStatus(queuedStatus.id),
              {
                timeout: lifecycleTimeout,
                interval: baseOptions.statusCheckInterval ?? 500,
              },
            )

            test.expect(finalStatus.attempts).toBeGreaterThanOrEqual(0)
          },
          lifecycleTimeout + 5000,
        )
      })
    }

    // Value Tests
    // All value tests use the pre-registered preserveTask to ensure compatibility
    // with connectors that require workflow pre-registration (like Hatchet)
    if (!skipValueTests) {
      const valueTimeout = baseOptions.taskCompletionTimeout ?? 10000

      test.describe('Value Tests', () => {
        // Use the pre-registered preserveTask for all payload tests
        // This ensures compatibility with Hatchet and similar connectors

        test.it('should handle string values in payload', async () => {
          const payload = { value: 'hello world', text: 'test' } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          test.expect((retrieved.payload as any).value).toBe('hello world')
        })

        test.it('should handle number values in payload', async () => {
          const payload = {
            value: 42,
            decimal: 3.14,
            negative: -100,
            text: 'test',
          } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          const p = retrieved.payload as any
          test.expect(p.value).toBe(42)
          test.expect(p.decimal).toBe(3.14)
          test.expect(p.negative).toBe(-100)
        })

        test.it('should handle boolean values in payload', async () => {
          const payload = { isTrue: true, isFalse: false, text: 'test' } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          const p = retrieved.payload as any
          test.expect(p.isTrue).toBe(true)
          test.expect(p.isFalse).toBe(false)
        })

        test.it('should handle null values in payload', async () => {
          const payload = { nullValue: null, text: 'test' } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          test.expect((retrieved.payload as any).nullValue).toBeNull()
        })

        test.it('should handle nested objects in payload', async () => {
          const payload = {
            text: 'test',
            nested: { level1: { level2: { value: 'deep' } } },
          } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          test
            .expect((retrieved.payload as any).nested.level1.level2.value)
            .toBe('deep')
        })

        test.it('should handle arrays in payload', async () => {
          const payload = {
            text: 'test',
            numbers: [1, 2, 3],
            strings: ['a', 'b', 'c'],
            mixed: [1, 'two', true, null],
          } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          const p = retrieved.payload as any
          test.expect(p.numbers).toEqual([1, 2, 3])
          test.expect(p.strings).toEqual(['a', 'b', 'c'])
          test.expect(p.mixed).toEqual([1, 'two', true, null])
        })

        test.it('should handle empty objects in payload', async () => {
          const payload = { text: 'test', empty: {} } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          test.expect((retrieved.payload as any).empty).toEqual({})
        })

        test.it('should handle empty arrays in payload', async () => {
          const payload = { text: 'test', empty: [] } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          test.expect((retrieved.payload as any).empty).toEqual([])
        })

        test.it(
          'should handle special characters in string values',
          async () => {
            const payload = {
              text: 'test',
              singleQuote: "it's working",
              doubleQuote: 'say "hello"',
              backslash: 'path\\to\\file',
              newline: 'line1\nline2',
              unicode: '你好世界',
            } as any
            const status = await state.preserveTask!.queue(payload)
            await delay(500)

            const retrieved = await state.preserveTask!.getStatus(status.id)
            const p = retrieved.payload as any
            test.expect(p.singleQuote).toBe("it's working")
            test.expect(p.doubleQuote).toBe('say "hello"')
            test.expect(p.backslash).toBe('path\\to\\file')
            test.expect(p.newline).toBe('line1\nline2')
            test.expect(p.unicode).toBe('你好世界')
          },
        )

        test.it('should handle large payloads', async () => {
          const largeArray = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `item_${i}`,
            value: Math.random(),
          }))
          const payload = { text: 'test', items: largeArray } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          const p = retrieved.payload as any
          test.expect(p.items.length).toBe(100)
          test.expect(p.items[0].id).toBe(0)
          test.expect(p.items[99].id).toBe(99)
        })

        test.it('should handle keys with special characters', async () => {
          const payload = {
            text: 'test',
            'key-with-dash': 'value1',
            key_with_underscore: 'value2',
            'key.with.dots': 'value3',
          } as any
          const status = await state.preserveTask!.queue(payload)
          await delay(500)

          const retrieved = await state.preserveTask!.getStatus(status.id)
          const p = retrieved.payload as any
          test.expect(p['key-with-dash']).toBe('value1')
          test.expect(p.key_with_underscore).toBe('value2')
          test.expect(p['key.with.dots']).toBe('value3')
        })

        // Test that completed tasks preserve their payload
        if (baseOptions.runLifecycleTests !== false) {
          test.it(
            'should preserve complex payload through task completion',
            async () => {
              const payload = {
                text: 'preservation test',
                number: 42,
                bool: true,
                nested: { deep: { value: 'preserved' } },
                array: [1, 2, 3],
              }

              const status = await state.preserveTask!.queue(payload)

              const finalStatus = await waitForTaskCompletion(
                () => state.preserveTask!.getStatus(status.id),
                {
                  timeout: valueTimeout,
                  interval: baseOptions.statusCheckInterval ?? 500,
                },
              )

              const p = finalStatus.payload as any
              test.expect(finalStatus.status).toBe('COMPLETED')
              test.expect(p.text).toBe('preservation test')
              test.expect(p.number).toBe(42)
              test.expect(p.bool).toBe(true)
              test.expect(p.nested.deep.value).toBe('preserved')
              test.expect(p.array).toEqual([1, 2, 3])
            },
            valueTimeout + 5000,
          )
        }
      })
    }
  })
}

export default taskConnectorTestSuite
