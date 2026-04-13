import type { ShouldQueue } from '../ShouldQueue'

// ─── Constructor → Instance Mapping ─────────────────────────────

/**
 * Maps a tuple of class constructors to a tuple of their instance types.
 * Used to derive typed task instances from a `const` task class array.
 *
 * Example:
 *   const classes = [ProcessPostTask, SendMessageTask] as const
 *   type Instances = ToInstances<typeof classes>
 *   // => [ProcessPostTask, SendMessageTask] (instance types)
 */
export type ToInstances<
  T extends readonly (abstract new (
    ...args: any
  ) => any)[],
> = {
  [K in keyof T]: InstanceType<T[K]>
}

// ─── String Utility Types ────────────────────────────────────────

/**
 * Convert a snake_case or kebab-case string to camelCase at the type level.
 *
 * Examples:
 *   SnakeToCamelCase<'process_post'>       => 'processPost'
 *   SnakeToCamelCase<'send_message'>        => 'sendMessage'
 *   SnakeToCamelCase<'check_comment'>       => 'checkComment'
 *   SnakeToCamelCase<'data_center_etl'>     => 'dataCenterEtl'
 *   SnakeToCamelCase<'dispatch-hints'>      => 'dispatchHints'
 *   SnakeToCamelCase<'singleword'>          => 'singleword'
 */
export type SnakeToCamelCase<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Lowercase<Head>}${SnakeToCamelCaseRest<Tail>}`
    : S extends `${infer Head}-${infer Tail}`
      ? `${Lowercase<Head>}${SnakeToCamelCaseRest<Tail>}`
      : Lowercase<S>

/**
 * Helper: capitalize the first letter of each segment after the first separator.
 * Handles both underscores and hyphens.
 * @internal
 */
type SnakeToCamelCaseRest<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Capitalize<Lowercase<Head>>}${SnakeToCamelCaseRest<Tail>}`
    : S extends `${infer Head}-${infer Tail}`
      ? `${Capitalize<Lowercase<Head>>}${SnakeToCamelCaseRest<Tail>}`
      : Capitalize<Lowercase<S>>

// ─── Task Extraction Types ───────────────────────────────────────

/**
 * Extract the TName string literal from a ShouldQueue subclass instance.
 */
export type ExtractTaskName<T> = T extends ShouldQueue<any, any, infer TName>
  ? TName
  : never

/**
 * Extract the TInput type from a ShouldQueue subclass instance.
 */
export type ExtractTaskInput<T> = T extends ShouldQueue<infer TInput, any, any>
  ? TInput
  : never

/**
 * Extract the TResult type from a ShouldQueue subclass instance.
 */
export type ExtractTaskResult<T> = T extends ShouldQueue<
  any,
  infer TResult,
  any
>
  ? TResult
  : never

// ─── Registry Map Types ──────────────────────────────────────────

/**
 * Given an array/tuple of ShouldQueue instances, build a mapped type where:
 *   - Keys are the camelCase version of each task's snake_case taskName
 *   - Values are the corresponding TInput type
 *
 * Example:
 *   TaskQueueMap<[
 *     ShouldQueue<ProcessPostTaskProps, undefined, 'process_post'>,
 *     ShouldQueue<SendMessageProps, undefined, 'send_message'>,
 *   ]>
 *   =>
 *   {
 *     processPost: ProcessPostTaskProps
 *     sendMessage: SendMessageProps
 *   }
 *
 * When TName is `string` (untyped tasks), the key becomes `string` and gets
 * merged into an index signature. Typed tasks still get autocomplete.
 */
export type TaskQueueMap<TTasks extends readonly ShouldQueue<any, any, any>[]> =
  {
    [K in TTasks[number] as SnakeToCamelCase<
      ExtractTaskName<K>
    >]: ExtractTaskInput<K>
  }

/**
 * The input shape for TaskRegistry.queue().
 * Accepts an object where each key is a camelCase task name and the value
 * is the corresponding input payload. Multiple tasks can be queued at once.
 *
 * Uses Partial so callers only specify the tasks they want to queue.
 */
export type TaskQueueInput<
  TTasks extends readonly ShouldQueue<any, any, any>[],
> = Partial<TaskQueueMap<TTasks>>

/**
 * Result of a TaskRegistry.queue() call.
 * Maps each queued task key to its job ID.
 */
export type TaskQueueResult<TKeys extends string = string> = {
  [K in TKeys]: { id: string }
}

// ─── Listen Types ───────────────────────────────────────────────

/**
 * Configuration for a single task in `listen()`.
 * `true` uses defaults; object form allows per-task overrides.
 */
export type ListenTaskConfig = true | { concurrency?: number }

/**
 * Input shape for `TaskRegistry.listen()`.
 * Keys are camelCase task names; values control per-task behavior.
 * When omitted entirely, all registered tasks are listened to.
 */
export type ListenInput<TTasks extends readonly ShouldQueue<any, any, any>[]> =
  Partial<{
    [K in TTasks[number] as SnakeToCamelCase<
      ExtractTaskName<K>
    >]: ListenTaskConfig
  }>

/**
 * Handle returned by `TaskRegistry.listen()`.
 */
export interface ListenHandle {
  stop: () => Promise<void>
  isRunning: () => boolean
}

// ─── Registry Options ───────────────────────────────────────────

/**
 * Options for creating a TaskRegistry instance.
 * Passed as the third argument to the constructor.
 */
export interface TaskRegistryOptions {
  /**
   * Optional logger for registry operations.
   */
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    debug?: (...args: unknown[]) => void
  }
}

/**
 * @deprecated Use TaskRegistryOptions instead.
 */
export type TaskRegistryConfig = TaskRegistryOptions

/**
 * Runtime function to convert a snake_case or kebab-case string to camelCase.
 *
 * Must match the behavior of SnakeToCamelCase<S> at compile time.
 *
 * @param s - A snake_case or kebab-case string (e.g., 'process_post', 'dispatch-hints')
 * @returns The camelCase equivalent (e.g., 'processPost', 'dispatchHints')
 */
export function snakeToCamelCase(s: string): string {
  return s.replace(/[_-]([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
