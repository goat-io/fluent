import type { TaskConnector } from '../ShouldQueue.types.js'

/**
 * Test framework interface that adapters must provide.
 * Compatible with Vitest's test API.
 */
export interface TestFramework {
  describe: (name: string, fn: () => void) => void
  it: (name: string, fn: () => Promise<void> | void, timeout?: number) => void
  expect: <T>(actual: T) => ExpectAPI<T>
  beforeAll: (fn: () => Promise<void> | void, timeout?: number) => void
  afterAll: (fn: () => Promise<void> | void, timeout?: number) => void
  beforeEach: (fn: () => Promise<void> | void) => void
  afterEach: (fn: () => Promise<void> | void) => void
}

/**
 * Basic expect API matching Vitest/Jest
 */
export interface ExpectAPI<T> {
  toBe: (expected: T) => void
  toEqual: (expected: unknown) => void
  toBeTruthy: () => void
  toBeFalsy: () => void
  toBeUndefined: () => void
  toBeDefined: () => void
  toBeNull: () => void
  toBeInstanceOf: (expected: unknown) => void
  toContain: (expected: unknown) => void
  toHaveProperty: (property: string, value?: unknown) => void
  toBeGreaterThan: (expected: number) => void
  toBeGreaterThanOrEqual: (expected: number) => void
  toBeLessThan: (expected: number) => void
  toBeLessThanOrEqual: (expected: number) => void
  toMatch: (expected: string | RegExp) => void
  toThrow: (expected?: string | RegExp | Error) => void
  resolves: ExpectAPI<T>
  rejects: ExpectAPI<T>
  not: ExpectAPI<T>
}

/**
 * Factory function type for creating a TaskConnector instance.
 * This allows the test suite to create fresh connector instances for each test.
 */
export type ConnectorFactory<TInput extends object = object> = () =>
  | TaskConnector<TInput>
  | Promise<TaskConnector<TInput>>

/**
 * Configuration options for the test suite
 */
export interface TestSuiteOptions {
  /**
   * Time to wait for task completion in milliseconds.
   * Default: 5000ms
   */
  taskCompletionTimeout?: number

  /**
   * Time to wait between status checks in milliseconds.
   * Default: 500ms
   */
  statusCheckInterval?: number

  /**
   * Whether to run lifecycle tests (requires worker to be running).
   * Default: true
   */
  runLifecycleTests?: boolean

  /**
   * Custom cleanup function called after all tests.
   */
  cleanup?: () => Promise<void>

  /**
   * Custom setup function called before all tests.
   */
  setup?: () => Promise<void>

  /**
   * Whether the connector supports task cancellation.
   * Default: false
   */
  supportsCancellation?: boolean

  /**
   * Whether the connector supports scheduled/delayed tasks.
   * Default: false
   */
  supportsScheduling?: boolean
}

/**
 * Test context passed to individual test functions
 */
export interface TestContext<TInput extends object = object> {
  connector: TaskConnector<TInput>
  options: Required<TestSuiteOptions>
}
