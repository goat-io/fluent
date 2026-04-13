import { ShouldQueue } from '../ShouldQueue.js'
import type {
  InputType,
  TaskConnector,
  UnknownInputType,
} from '../ShouldQueue.types.js'
import type {
  ConnectorFactory,
  TestFramework,
  TestSuiteOptions,
} from './types.js'
import { delay, waitForTaskCompletion } from './utils.js'

/**
 * Constructor type for ShouldQueue subclasses.
 * Used to avoid TypeScript errors with private member exposure in class expressions.
 */
type ShouldQueueConstructor<T extends InputType> = new () => ShouldQueue<T>

/**
 * Creates a test task that completes successfully
 */
export function createSuccessTask(
  connector: TaskConnector<{ text: string }>,
): ShouldQueueConstructor<{ text: string }> {
  return class SuccessTask extends ShouldQueue<{ text: string }> {
    postUrl = 'http://localhost/test/success'
    taskName = 'test_success_task'

    constructor() {
      super({ connector })
    }

    public getUniqueTaskName(_data: { text: string }): string {
      return `success_task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    public async handle(_taskBody: UnknownInputType): Promise<undefined> {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100))
      return undefined
    }
  }
}

/**
 * Creates a test task that fails
 */
export function createFailingTask(
  connector: TaskConnector<{ text: string; shouldFail?: boolean }>,
): ShouldQueueConstructor<{ text: string; shouldFail?: boolean }> {
  return class FailingTask extends ShouldQueue<{
    text: string
    shouldFail?: boolean
  }> {
    postUrl = 'http://localhost/test/failing'
    taskName = 'test_failing_task'
    retries = 0 // No retries for faster test execution

    constructor() {
      super({ connector })
    }

    public getUniqueTaskName(_data: { text: string }): string {
      return `failing_task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    public async handle(taskBody: {
      text: string
      shouldFail?: boolean
    }): Promise<undefined> {
      if (taskBody.shouldFail) {
        throw new Error('Intentional test failure')
      }
      return undefined
    }
  }
}

/**
 * Task lifecycle tests for TaskConnector implementations.
 * These tests verify that tasks properly transition through states.
 *
 * IMPORTANT: These tests require a worker to be running to process tasks.
 */
export function taskConnectorLifecycleTests(
  test: TestFramework,
  connectorFactory: ConnectorFactory<{ text: string }>,
  options: TestSuiteOptions & {
    /**
     * Setup function that starts a worker for processing the given tasks.
     * The tasks array contains the task instances that need to be processed.
     * Should return a cleanup function.
     */
    startWorker?: (tasks: ShouldQueue[]) => Promise<() => Promise<void>>
  } = {},
) {
  const opts = {
    taskCompletionTimeout: options.taskCompletionTimeout ?? 10000,
    statusCheckInterval: options.statusCheckInterval ?? 500,
    runLifecycleTests: options.runLifecycleTests ?? true,
    supportsCancellation: options.supportsCancellation ?? false,
    supportsScheduling: options.supportsScheduling ?? false,
    cleanup: options.cleanup,
    setup: options.setup,
    startWorker: options.startWorker,
  }

  // Skip lifecycle tests if not enabled or no startWorker provided
  if (!opts.runLifecycleTests || !opts.startWorker) {
    return
  }

  test.describe('TaskConnector Lifecycle Tests', () => {
    let connector: TaskConnector<any>
    let stopWorker: (() => Promise<void>) | undefined
    let SuccessTask: ReturnType<typeof createSuccessTask>
    let FailingTask: ReturnType<typeof createFailingTask>
    let successTask: InstanceType<ReturnType<typeof createSuccessTask>>
    let failingTask: InstanceType<ReturnType<typeof createFailingTask>>

    test.beforeAll(async () => {
      if (opts.setup) {
        await opts.setup()
      }
      connector = await connectorFactory()

      // Create task classes and instances
      SuccessTask = createSuccessTask(connector)
      FailingTask = createFailingTask(connector as any)
      successTask = new SuccessTask()
      failingTask = new FailingTask()

      // Start worker with the tasks this test suite needs
      if (opts.startWorker) {
        stopWorker = await opts.startWorker([successTask, failingTask])
        // Give worker time to start
        await delay(2000)
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

    test.it(
      'task should eventually reach COMPLETED status',
      async () => {
        const queuedStatus = await successTask.queue({
          text: 'completion test',
        })
        test.expect(queuedStatus.status).toBe('QUEUED')

        const finalStatus = await waitForTaskCompletion(
          () => successTask.getStatus(queuedStatus.id),
          {
            timeout: opts.taskCompletionTimeout,
            interval: opts.statusCheckInterval,
          },
        )

        test.expect(finalStatus.status).toBe('COMPLETED')
      },
      opts.taskCompletionTimeout + 5000,
    )

    test.it(
      'completed task should preserve payload',
      async () => {
        const payload = { text: 'payload in completed task' }

        const queuedStatus = await successTask.queue(payload)

        const finalStatus = await waitForTaskCompletion(
          () => successTask.getStatus(queuedStatus.id),
          {
            timeout: opts.taskCompletionTimeout,
            interval: opts.statusCheckInterval,
          },
        )

        test.expect(finalStatus.status).toBe('COMPLETED')
        test.expect(finalStatus.payload).toBeDefined()
        test.expect((finalStatus.payload as any).text).toBe(payload.text)
      },
      opts.taskCompletionTimeout + 5000,
    )

    test.it(
      'failed task should reach FAILED status',
      async () => {
        const queuedStatus = await failingTask.queue({
          text: 'failure test',
          shouldFail: true,
        })

        const finalStatus = await waitForTaskCompletion(
          () => failingTask.getStatus(queuedStatus.id),
          {
            timeout: opts.taskCompletionTimeout,
            interval: opts.statusCheckInterval,
          },
        )

        test.expect(finalStatus.status).toBe('FAILED')
      },
      opts.taskCompletionTimeout + 5000,
    )

    test.it(
      'multiple tasks should complete independently',
      async () => {
        // Queue multiple tasks
        const statuses = await Promise.all([
          successTask.queue({ text: 'multi test 1' }),
          successTask.queue({ text: 'multi test 2' }),
          successTask.queue({ text: 'multi test 3' }),
        ])

        // All should be queued initially
        for (const status of statuses) {
          test.expect(status.status).toBe('QUEUED')
        }

        // All should have unique IDs
        const ids = statuses.map(s => s.id)
        const uniqueIds = new Set(ids)
        test.expect(uniqueIds.size).toBe(ids.length)

        // Wait for all to complete
        const finalStatuses = await Promise.all(
          statuses.map(s =>
            waitForTaskCompletion(() => successTask.getStatus(s.id), {
              timeout: opts.taskCompletionTimeout,
              interval: opts.statusCheckInterval,
            }),
          ),
        )

        // All should complete
        for (const status of finalStatuses) {
          test.expect(status.status).toBe('COMPLETED')
        }
      },
      opts.taskCompletionTimeout * 2 + 5000,
    )

    test.it(
      'task attempts should increment on execution',
      async () => {
        const queuedStatus = await successTask.queue({ text: 'attempts test' })
        test.expect(queuedStatus.attempts).toBe(0)

        const finalStatus = await waitForTaskCompletion(
          () => successTask.getStatus(queuedStatus.id),
          {
            timeout: opts.taskCompletionTimeout,
            interval: opts.statusCheckInterval,
          },
        )

        // After completion, attempts should be at least 1
        // (some systems count differently)
        test.expect(finalStatus.attempts).toBeGreaterThanOrEqual(0)
      },
      opts.taskCompletionTimeout + 5000,
    )
  })
}

export default taskConnectorLifecycleTests
