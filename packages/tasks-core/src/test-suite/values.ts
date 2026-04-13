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
 * Creates a generic test task for any payload type
 */
export function createGenericTask<T extends InputType>(
  connector: TaskConnector<T>,
  taskName: string,
): ShouldQueueConstructor<T> {
  return class GenericTask extends ShouldQueue<T> {
    postUrl = 'http://localhost/test/generic'
    taskName = taskName

    constructor() {
      super({ connector })
    }

    public getUniqueTaskName(_data: T): string {
      return `generic_task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    public async handle(_taskBody: UnknownInputType): Promise<undefined> {
      return undefined
    }
  }
}

/**
 * Value/payload tests for TaskConnector implementations.
 * These tests verify that various data types are correctly serialized and preserved.
 */
export function taskConnectorValueTests(
  test: TestFramework,
  connectorFactory: ConnectorFactory<any>,
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

  test.describe('TaskConnector Value Tests', () => {
    let connector: TaskConnector<any>
    let stopWorker: (() => Promise<void>) | undefined
    let preserveTask: ShouldQueue | undefined

    test.beforeAll(async () => {
      if (opts.setup) {
        await opts.setup()
      }
      connector = await connectorFactory()

      // Create the task for the preserve test if we're running lifecycle tests
      if (opts.runLifecycleTests && opts.startWorker) {
        const PreserveTask = createGenericTask(connector, 'test_preserve_task')
        preserveTask = new PreserveTask()
        stopWorker = await opts.startWorker([preserveTask])
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

    test.it('should handle string values in payload', async () => {
      const Task = createGenericTask(connector, 'test_string_task')
      const task = new Task()
      const payload = { value: 'hello world', text: 'test' }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.value).toBe('hello world')
    })

    test.it('should handle number values in payload', async () => {
      const Task = createGenericTask(connector, 'test_number_task')
      const task = new Task()
      const payload = { value: 42, decimal: 3.14, negative: -100, text: 'test' }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.value).toBe(42)
      test.expect(retrieved.payload.decimal).toBe(3.14)
      test.expect(retrieved.payload.negative).toBe(-100)
    })

    test.it('should handle boolean values in payload', async () => {
      const Task = createGenericTask(connector, 'test_boolean_task')
      const task = new Task()
      const payload = { isTrue: true, isFalse: false, text: 'test' }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.isTrue).toBe(true)
      test.expect(retrieved.payload.isFalse).toBe(false)
    })

    test.it('should handle null values in payload', async () => {
      const Task = createGenericTask(connector, 'test_null_task')
      const task = new Task()
      const payload = { nullValue: null, text: 'test' }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.nullValue).toBeNull()
    })

    test.it('should handle nested objects in payload', async () => {
      const Task = createGenericTask(connector, 'test_nested_task')
      const task = new Task()
      const payload = {
        text: 'test',
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
      }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.nested.level1.level2.value).toBe('deep')
    })

    test.it('should handle arrays in payload', async () => {
      const Task = createGenericTask(connector, 'test_array_task')
      const task = new Task()
      const payload = {
        text: 'test',
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
        mixed: [1, 'two', true, null],
      }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.numbers).toEqual([1, 2, 3])
      test.expect(retrieved.payload.strings).toEqual(['a', 'b', 'c'])
      test.expect(retrieved.payload.mixed).toEqual([1, 'two', true, null])
    })

    test.it('should handle empty objects in payload', async () => {
      const Task = createGenericTask(connector, 'test_empty_obj_task')
      const task = new Task()
      const payload = { text: 'test', empty: {} }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.empty).toEqual({})
    })

    test.it('should handle empty arrays in payload', async () => {
      const Task = createGenericTask(connector, 'test_empty_arr_task')
      const task = new Task()
      const payload = { text: 'test', empty: [] }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.empty).toEqual([])
    })

    test.it('should handle special characters in string values', async () => {
      const Task = createGenericTask(connector, 'test_special_char_task')
      const task = new Task()
      const payload = {
        text: 'test',
        singleQuote: "it's working",
        doubleQuote: 'say "hello"',
        backslash: 'path\\to\\file',
        newline: 'line1\nline2',
        tab: 'col1\tcol2',
        unicode: '你好世界 🎉',
      }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.singleQuote).toBe("it's working")
      test.expect(retrieved.payload.doubleQuote).toBe('say "hello"')
      test.expect(retrieved.payload.backslash).toBe('path\\to\\file')
      test.expect(retrieved.payload.newline).toBe('line1\nline2')
      test.expect(retrieved.payload.unicode).toBe('你好世界 🎉')
    })

    test.it('should handle large payloads', async () => {
      const Task = createGenericTask(connector, 'test_large_payload_task')
      const task = new Task()
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `item_${i}`,
        value: Math.random(),
      }))
      const payload = { text: 'test', items: largeArray }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload.items.length).toBe(100)
      test.expect(retrieved.payload.items[0].id).toBe(0)
      test.expect(retrieved.payload.items[99].id).toBe(99)
    })

    test.it('should handle keys with special characters', async () => {
      const Task = createGenericTask(connector, 'test_special_key_task')
      const task = new Task()
      const payload = {
        text: 'test',
        'key-with-dash': 'value1',
        key_with_underscore: 'value2',
        'key.with.dots': 'value3',
      }

      const status = await task.queue(payload)
      await delay(100)

      const retrieved = await task.getStatus(status.id)
      test.expect(retrieved.payload['key-with-dash']).toBe('value1')
      test.expect(retrieved.payload.key_with_underscore).toBe('value2')
      test.expect(retrieved.payload['key.with.dots']).toBe('value3')
    })

    // Test that completed tasks preserve their payload
    if (opts.runLifecycleTests && opts.startWorker) {
      test.it(
        'should preserve complex payload through task completion',
        async () => {
          // Use the preserveTask created in beforeAll
          if (!preserveTask) {
            throw new Error('preserveTask not initialized')
          }
          const payload = {
            text: 'preservation test',
            number: 42,
            bool: true,
            nested: { deep: { value: 'preserved' } },
            array: [1, 2, 3],
          }

          const status = await preserveTask.queue(payload)

          const finalStatus = await waitForTaskCompletion(
            () => preserveTask!.getStatus(status.id),
            {
              timeout: opts.taskCompletionTimeout,
              interval: opts.statusCheckInterval,
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
        opts.taskCompletionTimeout + 5000,
      )
    }
  })
}

export default taskConnectorValueTests
