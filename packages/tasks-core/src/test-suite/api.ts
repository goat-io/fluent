import { ShouldQueue } from '../ShouldQueue.js'
import type { TaskConnector, UnknownInputType } from '../ShouldQueue.types.js'
import type {
  ConnectorFactory,
  TestFramework,
  TestSuiteOptions
} from './types.js'
import { delay } from './utils.js'

/**
 * Creates a test task class for the given connector
 * @internal
 */
export function createApiTestTask(connector: TaskConnector<{ text: string }>) {
  return class ApiTestTask extends ShouldQueue<{ text: string }> {
    postUrl = 'http://localhost/test/task'
    taskName = 'test_api_task'

    constructor() {
      super({ connector })
    }

    public getUniqueTaskName(_data: { text: string }): string {
      return `test_task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    public async handle(_taskBody: UnknownInputType): Promise<undefined> {
      return undefined
    }
  }
}

/**
 * Core API tests for TaskConnector implementations.
 * These tests verify the basic queue() and getStatus() functionality.
 *
 * @param test - Test framework instance
 * @param connectorFactory - Factory to create connector
 * @param options - Test options
 * @param sharedTask - Optional pre-created task instance (for unified test runner)
 */
export function taskConnectorApiTests(
  test: TestFramework,
  connectorFactory: ConnectorFactory<{ text: string }>,
  options: TestSuiteOptions & {
    startWorker?: (tasks: ShouldQueue[]) => Promise<() => Promise<void>>
  } = {},
  sharedTask?: ShouldQueue<{ text: string }>
) {
  const opts = {
    taskCompletionTimeout: options.taskCompletionTimeout ?? 5000,
    statusCheckInterval: options.statusCheckInterval ?? 500,
    runLifecycleTests: options.runLifecycleTests ?? true,
    supportsCancellation: options.supportsCancellation ?? false,
    supportsScheduling: options.supportsScheduling ?? false,
    cleanup: options.cleanup,
    setup: options.setup,
    startWorker: options.startWorker
  }

  test.describe('TaskConnector API Tests', () => {
    let connector: TaskConnector<{ text: string }>
    let task: ShouldQueue<{ text: string }>
    let stopWorker: (() => Promise<void>) | undefined

    test.beforeAll(async () => {
      if (opts.setup) {
        await opts.setup()
      }
      connector = await connectorFactory()

      // Use shared task if provided, otherwise create one
      if (sharedTask) {
        task = sharedTask
      } else {
        const ApiTestTask = createApiTestTask(connector)
        task = new ApiTestTask()

        // Start worker if provided (needed for Hatchet-style connectors)
        if (opts.startWorker) {
          stopWorker = await opts.startWorker([task])
          await delay(2000) // Give worker time to register
        }
      }
    }, 60000)

    test.afterAll(async () => {
      if (stopWorker) {
        await stopWorker()
      }
      if (opts.cleanup) {
        await opts.cleanup()
      }
    })

    test.it('queue() should return a task status object', async () => {
      const status = await task.queue({ text: 'test message' })

      test.expect(status).toBeDefined()
      test.expect(status).toHaveProperty('id')
      test.expect(status).toHaveProperty('name')
      test.expect(status).toHaveProperty('status')
      test.expect(status).toHaveProperty('created')
      test.expect(status).toHaveProperty('attempts')
    })

    test.it('queue() should return QUEUED status initially', async () => {
      const status = await task.queue({ text: 'queued test' })

      test.expect(status.status).toBe('QUEUED')
    })

    test.it(
      'queue() should return task name containing the defined taskName',
      async () => {
        const status = await task.queue({ text: 'name test' })

        test.expect(status.name).toContain('test_api_task')
      }
    )

    test.it('queue() should return a unique id for each task', async () => {
      const status1 = await task.queue({ text: 'unique test 1' })
      const status2 = await task.queue({ text: 'unique test 2' })

      test.expect(status1.id).toBeDefined()
      test.expect(status2.id).toBeDefined()
      test.expect(status1.id).not.toBe(status2.id)
    })

    test.it('queue() should not include payload in response', async () => {
      const status = await task.queue({ text: 'no payload test' })

      test.expect(status).not.toHaveProperty('payload')
    })

    test.it('queue() should set attempts to 0', async () => {
      const status = await task.queue({ text: 'attempts test' })

      test.expect(status.attempts).toBe(0)
    })

    test.it('queue() should set created timestamp', async () => {
      const status = await task.queue({ text: 'timestamp test' })

      test.expect(status.created).toBeDefined()
      // Created should be a valid ISO string
      test.expect(() => new Date(status.created)).not.toThrow()
    })

    test.it(
      'getStatus() should return full task status with payload',
      async () => {
        const queuedStatus = await task.queue({ text: 'get status test' })

        // Small delay to ensure task is persisted
        await delay(100)

        const status = await task.getStatus(queuedStatus.id)

        test.expect(status).toBeDefined()
        test.expect(status).toHaveProperty('id', queuedStatus.id)
        test.expect(status).toHaveProperty('name')
        test.expect(status).toHaveProperty('status')
        test.expect(status).toHaveProperty('payload')
      }
    )

    test.it('getStatus() should return the original payload', async () => {
      const payload = { text: 'payload preservation test' }
      const queuedStatus = await task.queue(payload)

      await delay(100)

      const status = await task.getStatus(queuedStatus.id)

      test.expect(status.payload).toBeDefined()
      test.expect(status.payload.text).toBe(payload.text)
    })

    test.it('getStatus() should return same id as queue()', async () => {
      const queuedStatus = await task.queue({ text: 'id match test' })

      await delay(100)

      const status = await task.getStatus(queuedStatus.id)

      test.expect(status.id).toBe(queuedStatus.id)
    })
  })
}

export default taskConnectorApiTests
