import { Ids, Memo } from '@goatlab/js-utils'
import type {
  ShouldQueue,
  TaskConnector,
  TaskStatus,
  TaskStatusName,
  TenantCredentials,
} from '@goatlab/tasks-core'
import type { ConnectionOptions, JobsOptions } from 'bullmq'
import { type Job, Queue, Worker } from 'bullmq'
import type { Cluster, Redis, RedisOptions } from 'ioredis'

// Default configuration constants
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 6379
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_CONCURRENCY = 100
const DEFAULT_PREFIX = 'bull'

/**
 * Connection options passed through to ioredis.
 * Supports all RedisOptions (TLS, keepAlive, reconnectOnError, etc.)
 */
export type BullMQConnectionOptions = RedisOptions

export interface BullMQConnectorConfig {
  connection?: BullMQConnectionOptions
  /**
   * Pre-built ioredis instance (Redis or Cluster).
   * Takes precedence over `connection` options.
   * BullMQ Queue/Worker accept ioredis instances directly as `connection`.
   * Cluster instances are safe to share across tenants since isolation is via key prefix.
   */
  redisInstance?: Redis | Cluster
  defaultJobOptions?: JobsOptions
  /**
   * Tenant ID for multi-tenant isolation.
   * When set, this tenant ID is used as a prefix for all Redis keys.
   *
   * Key pattern: {tenantId}:bull:{queueName}:{keyType}
   * Example: "acme-corp:bull:email-queue:waiting"
   *
   * This enables Redis ACL rules like: ~acme-corp:* +@all
   * to restrict tenant access to only their prefixed keys.
   */
  tenantId?: string
  /**
   * Custom Redis key prefix override.
   * When set, overrides the default prefix logic entirely.
   * Default: '{tenantId}:bull' if tenantId is set, otherwise 'bull'.
   *
   * Useful for dispatch queues that need a different namespace (e.g., 'dispatch').
   */
  prefix?: string
  /**
   * Optional hook called after a job is successfully enqueued.
   * Used by the dispatch system to write a hint to the global dispatch queue.
   * Failures are non-fatal — the job is already enqueued.
   */
  onAfterQueue?: (params: {
    tenantId: string
    queueName: string
    jobId: string
    priority?: number
  }) => Promise<void>
}

/**
 * Maps BullMQ job states to TaskStatusName
 */
const mapJobStateToStatus = (state: string | undefined): TaskStatusName => {
  switch (state) {
    case 'completed':
      return 'COMPLETED'
    case 'failed':
      return 'FAILED'
    case 'active':
      return 'RUNNING'
    case 'waiting':
    case 'delayed':
    case 'prioritized':
    case 'waiting-children':
      return 'QUEUED'
    default:
      return 'QUEUED'
  }
}

export class BullMQConnector implements TaskConnector<object> {
  private readonly connectionOptions: ConnectionOptions
  private readonly defaultJobOptions: JobsOptions
  private readonly queues: Map<string, Queue> = new Map()
  private readonly workers: Map<string, Worker> = new Map()
  private readonly _tenantId?: string
  private readonly _prefix: string
  private readonly config: BullMQConnectorConfig

  /**
   * Shared ioredis instance for non-blocking operations (Queue enqueue,
   * temp Worker getNextJob). Lazily created on first use. All Queue
   * instances reuse this single TCP connection instead of each creating
   * their own, keeping connection count O(1) per connector regardless
   * of how many queues are used.
   *
   * Persistent blocking Workers (startWorker/getBullMQWorker) use raw
   * connectionOptions so they get dedicated connections for BRPOPLPUSH.
   */
  private _sharedClient: Redis | Cluster | null = null

  /**
   * Optional hook called after a job is successfully enqueued.
   * Set via constructor config. Failures are non-fatal.
   */
  public onAfterQueue?: TaskConnector<object>['onAfterQueue']

  /**
   * The tenant ID this connector is scoped to.
   * When set, all Redis keys are prefixed with this tenant ID.
   */
  public get tenantId(): string | undefined {
    return this._tenantId
  }

  /**
   * The Redis key prefix used by this connector.
   * Format: "{tenantId}:bull" if tenant is set, otherwise "bull" (default)
   *
   * This prefix is applied to all queue names, resulting in keys like:
   * - With tenant: "acme-corp:bull:email-queue:waiting"
   * - Without tenant: "bull:email-queue:waiting"
   */
  public get prefix(): string {
    return this._prefix
  }

  constructor(config?: BullMQConnectorConfig) {
    this.config = config || {}
    this._tenantId = config?.tenantId

    // Prefix priority: explicit prefix > tenantId-based > default 'bull'
    // Keys will be: {prefix}:{queueName}:{keyType}
    let prefix =
      config?.prefix ??
      (config?.tenantId
        ? `${config.tenantId}:${DEFAULT_PREFIX}`
        : DEFAULT_PREFIX)

    // Redis Cluster: BullMQ Lua scripts touch multiple keys per queue.
    // All must hash to the same slot. Wrapping the prefix in {} hash tags
    // ensures Redis uses only the tagged portion for slot calculation.
    // Detect Cluster by checking for the .nodes() method.
    const isCluster =
      config?.redisInstance &&
      typeof (config.redisInstance as any).nodes === 'function'
    if (isCluster && !prefix.startsWith('{')) {
      prefix = `{${prefix}}`
    }

    this._prefix = prefix

    // If a pre-built ioredis instance is provided, use it directly.
    // BullMQ Queue/Worker accept ioredis.Redis or ioredis.Cluster as connection.
    // Otherwise, spread ALL user connection options so TLS, keepAlive, etc. pass through.
    this.connectionOptions = config?.redisInstance
      ? config.redisInstance
      : {
          host: DEFAULT_HOST,
          port: DEFAULT_PORT,
          maxRetriesPerRequest: null, // Required by BullMQ
          family: 4,
          ...config?.connection, // Spread ALL user options (TLS, keepAlive, etc.)
        }

    this.defaultJobOptions = config?.defaultJobOptions || {
      attempts: DEFAULT_MAX_RETRIES,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    }

    this.onAfterQueue = config?.onAfterQueue
  }

  /**
   * Returns a shared ioredis connection for non-blocking operations.
   * Creates one lazily on first call. If the connector was constructed
   * with a `redisInstance`, returns that directly (already shared).
   */
  private getSharedConnection(): ConnectionOptions {
    // Already have a pre-built instance (passed via config or previous call)
    if (this.config.redisInstance) {
      return this.config.redisInstance
    }

    // Lazily create a single shared ioredis instance
    if (!this._sharedClient) {
      // Dynamic import would be cleaner but ioredis is already a dependency
      // of bullmq, so it's always available.
      const IORedis = require('ioredis').default || require('ioredis')
      this._sharedClient = new IORedis({
        host: DEFAULT_HOST,
        port: DEFAULT_PORT,
        maxRetriesPerRequest: null,
        family: 4,
        ...this.config.connection,
        // Prevent ioredis from exiting the process on connection errors
        lazyConnect: false,
      }) as Redis

      // Suppress unhandled error events (BullMQ attaches its own handlers)
      this._sharedClient.on('error', () => {})
    }

    return this._sharedClient
  }

  /**
   * Creates a new BullMQConnector instance scoped to a specific tenant.
   * The new connector uses the tenant ID as a Redis key prefix for isolation.
   *
   * @param tenantId - The tenant identifier for isolation
   * @param credentials - Optional credentials for the tenant's Redis user
   * @returns A new BullMQConnector instance scoped to the tenant
   *
   * @example
   * ```typescript
   * const baseConnector = new BullMQConnector({ connection: { host: 'localhost' } })
   *
   * // Create tenant-scoped connector (uses prefix isolation)
   * const tenantConnector = baseConnector.forTenant('acme-corp')
   * // Keys: acme-corp:queue-name:*
   *
   * // With Redis ACL credentials for stronger isolation
   * const secureConnector = baseConnector.forTenant('acme-corp', {
   *   username: 'tenant_acme',
   *   password: 'secret'
   * })
   * ```
   */
  forTenant(
    tenantId: string,
    credentials?: TenantCredentials,
  ): BullMQConnector {
    // When no per-tenant credentials are provided, share the parent's
    // ioredis connection so all tenants reuse one TCP connection.
    // Tenant isolation is via key prefix, not separate connections.
    const sharedInstance =
      !credentials?.username && !credentials?.password
        ? (this.getSharedConnection() as Redis | Cluster)
        : undefined

    // Spread parent config but remove explicit prefix — the child connector
    // should derive its prefix from the new tenantId, not inherit the parent's.
    const { prefix: _parentPrefix, ...parentConfig } = this.config

    return new BullMQConnector({
      ...parentConfig,
      tenantId,
      // Propagate shared Redis instance when credentials match
      redisInstance: sharedInstance ?? this.config.redisInstance,
      connection: {
        ...this.config.connection,
        // Override credentials if provided for stronger isolation
        ...(credentials?.username && { username: credentials.username }),
        ...(credentials?.password && { password: credentials.password }),
      },
    })
  }

  /**
   * Gets or creates a queue for a given queue name.
   * Queues are memoized to avoid creating multiple instances.
   *
   * When a tenant ID is set, the queue uses the tenant ID as the Redis key prefix.
   * This ensures all keys are namespaced under the tenant.
   *
   * Key patterns:
   * - With tenant "acme-corp": acme-corp:bull:email-queue:waiting
   * - Without tenant: bull:email-queue:waiting
   */
  @Memo.syncMethod()
  public getQueue(queueName: string): Queue {
    const cacheKey = `${this._prefix}:${queueName}`
    const existing = this.queues.get(cacheKey)
    if (existing) {
      return existing
    }

    const queue = new Queue(queueName, {
      connection: this.getSharedConnection(),
      defaultJobOptions: this.defaultJobOptions,
      prefix: this._prefix,
    })

    this.queues.set(cacheKey, queue)
    return queue
  }

  /**
   * Creates a worker for processing jobs from a BullMQ task.
   * Similar to Hatchet's getHatchetTask but creates a worker.
   *
   * IMPORTANT: The worker uses the same prefix as the queue to ensure
   * it processes jobs from the correct tenant namespace.
   */
  public getBullMQWorker(
    task: ShouldQueue,
    concurrency = DEFAULT_CONCURRENCY,
  ): Worker {
    const worker = new Worker(
      task.taskName,
      async (job: Job) => {
        return task.handle(job.data)
      },
      {
        connection: this.connectionOptions,
        concurrency,
        prefix: this._prefix,
      },
    )

    return worker
  }

  /**
   * Starts a worker to process jobs for the given tasks.
   * Similar pattern to HatchetConnector.startWorker().
   *
   * IMPORTANT: Workers use the same prefix as queues to ensure
   * they only process jobs from the correct tenant namespace.
   */
  async startWorker({
    workerName,
    tasks,
    concurrency = DEFAULT_CONCURRENCY,
  }: {
    workerName?: string
    tasks: ShouldQueue[]
    concurrency?: number
  }): Promise<Worker[]> {
    const workers: Worker[] = []

    for (const task of tasks) {
      const workerKey = `${this._prefix}:${task.taskName}`
      const worker = new Worker(
        task.taskName,
        async (job: Job) => {
          return task.handle(job.data)
        },
        {
          connection: this.connectionOptions,
          concurrency,
          name: `${workerName || task.taskName}-${Ids.nanoId(5)}`,
          prefix: this._prefix,
        },
      )

      this.workers.set(workerKey, worker)
      workers.push(worker)
    }

    // Give workers some time to start and connect to Redis
    await new Promise(resolve => setTimeout(resolve, 1000))

    return workers
  }

  /**
   * Stops all workers and closes all queue connections.
   * Also disconnects the shared ioredis client if one was created.
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = []

    for (const worker of this.workers.values()) {
      closePromises.push(worker.close())
    }

    for (const queue of this.queues.values()) {
      closePromises.push(queue.close())
    }

    await Promise.all(closePromises)
    this.workers.clear()
    this.queues.clear()

    // Disconnect the shared client (only if we created it, not if user provided redisInstance)
    if (this._sharedClient && !this.config.redisInstance) {
      this._sharedClient.disconnect()
      this._sharedClient = null
    }
  }

  /**
   * Gets the status of a job by its ID.
   * Implements the TaskConnector interface.
   * @param id - Job ID (in format: queueName:jobId or just jobId if queueName is known)
   */
  async getStatus(id: string): Promise<TaskStatus> {
    // Parse the id which may be in format "queueName:jobId"
    const [queueName, jobId] = id.includes(':')
      ? id.split(':')
      : [this.getDefaultQueueName(), id]

    const queue = this.getQueue(queueName)
    const job = await queue.getJob(jobId)

    if (!job) {
      // Job not found - could be completed and removed
      return {
        id,
        name: queueName,
        status: 'COMPLETED',
        output: '',
        attempts: 0,
        created: new Date().toISOString(),
        nextRun: null,
        nextRunMinutes: null,
        payload: {},
      }
    }

    const state = await job.getState()
    const status = mapJobStateToStatus(state)

    return {
      id,
      name: job.name,
      status,
      output: job.returnvalue ? JSON.stringify(job.returnvalue) : '',
      attempts: job.attemptsMade,
      created: new Date(job.timestamp).toISOString(),
      nextRun: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      nextRunMinutes: null,
      payload: job.data || {},
    }
  }

  /**
   * Gets the default queue name.
   * Used when no queue name is specified.
   */
  private getDefaultQueueName(): string {
    return 'default'
  }

  /**
   * Queues a task to be run in the background.
   * Implements the TaskConnector interface.
   * @param params
   * @param params.uniqueTaskName - Unique name for this task instance
   * @param params.taskName - Name of the task/queue
   * @param params.postUrl - URL to post the task to (not used in BullMQ, kept for interface compatibility)
   * @param params.taskBody - Body/data of the task
   * @param params.handle - Handler function for the task
   */
  async queue(params: {
    uniqueTaskName: string
    taskName: string
    postUrl: string
    taskBody: object
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>> {
    const queue = this.getQueue(params.taskName)

    // Create a unique job ID using the uniqueTaskName and a nanoId
    const jobId = `${params.uniqueTaskName}_${Ids.nanoId(5)}`

    const job = await queue.add(params.taskName, params.taskBody, {
      jobId,
      ...this.defaultJobOptions,
    })

    const resultId = `${params.taskName}:${job.id}`

    // Fire onAfterQueue hook (non-fatal — job is already enqueued)
    if (this.onAfterQueue && this._tenantId) {
      try {
        await this.onAfterQueue({
          tenantId: this._tenantId,
          queueName: params.taskName,
          jobId: resultId,
        })
      } catch {
        // Dispatch hint failure is non-fatal
      }
    }

    const now = new Date().toISOString()

    return {
      id: resultId,
      name: params.taskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: now,
      nextRun: null,
      nextRunMinutes: null,
    }
  }

  /**
   * TaskConnector.bulkQueue — group jobs by target queue and use BullMQ's
   * native Queue.addBulk per queue (one Lua script roundtrip per queue,
   * vs. N for a queue() loop).
   *
   * Returns TaskStatus objects in the same order as input. The backing
   * BullMQ jobs use `uniqueTaskName` as their idempotency jobId.
   *
   * Note: BullMQ has a known performance edge above ~1000 jobs per addBulk
   * call (issue #1670). Callers should chunk if they need to push more than
   * 1000 at once.
   */
  async bulkQueue(
    jobs: Array<{
      uniqueTaskName: string
      taskName: string
      taskBody: object
      opts?: Record<string, unknown>
    }>,
  ): Promise<Omit<TaskStatus, 'payload'>[]> {
    if (jobs.length === 0) {
      return []
    }

    // Group by target queue so each addBulk is one LUA roundtrip.
    // We track the original index so we can reassemble results in order.
    const byQueue = new Map<
      string,
      Array<{ idx: number; job: (typeof jobs)[number] }>
    >()
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i]!
      let bucket = byQueue.get(j.taskName)
      if (!bucket) {
        bucket = []
        byQueue.set(j.taskName, bucket)
      }
      bucket.push({ idx: i, job: j })
    }

    const results: Omit<TaskStatus, 'payload'>[] = new Array(jobs.length)
    const now = new Date().toISOString()

    await Promise.all(
      Array.from(byQueue.entries()).map(async ([queueName, bucket]) => {
        const queue = this.getQueue(queueName)
        const bulk = bucket.map(({ job }) => ({
          name: queueName,
          data: job.taskBody,
          opts: {
            jobId: job.uniqueTaskName,
            ...this.defaultJobOptions,
            ...(job.opts ?? {}),
          },
        }))
        const enqueued = await queue.addBulk(bulk)

        for (let i = 0; i < bucket.length; i++) {
          const { idx } = bucket[i]!
          const j = enqueued[i]!
          results[idx] = {
            id: `${queueName}:${j.id}`,
            name: queueName,
            output: '',
            attempts: 0,
            status: 'QUEUED',
            created: now,
            nextRun: null,
            nextRunMinutes: null,
          }
        }

        // Fire onAfterQueue per job so dispatch hints stay accurate
        if (this.onAfterQueue && this._tenantId) {
          for (let i = 0; i < bucket.length; i++) {
            try {
              await this.onAfterQueue({
                tenantId: this._tenantId,
                queueName,
                jobId: results[bucket[i]!.idx]!.id,
              })
            } catch {
              /* non-fatal */
            }
          }
        }
      }),
    )
    return results
  }

  /**
   * Adds a job to a queue with custom options.
   * This is a convenience method for more advanced usage.
   */
  async addJob<T extends object>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName)
    return queue.add(jobName, data, {
      ...this.defaultJobOptions,
      ...options,
    })
  }

  /**
   * Gets a job by its ID from a specific queue.
   */
  async getJob<T = any>(
    queueName: string,
    jobId: string,
  ): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName)
    return queue.getJob(jobId)
  }

  /**
   * Removes a job by its ID from a specific queue.
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName)
    const job = await queue.getJob(jobId)
    if (job) {
      await job.remove()
    }
  }

  /**
   * Pauses a queue.
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName)
    await queue.pause()
  }

  /**
   * Resumes a paused queue.
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName)
    await queue.resume()
  }

  /**
   * Gets the count of jobs in different states for a queue.
   */
  async getJobCounts(queueName: string): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    const queue = this.getQueue(queueName)
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    )
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    }
  }

  /**
   * Lists failed jobs in a queue.
   */
  async listFailedJobs(
    queueName: string,
    start = 0,
    end = 100,
  ): Promise<Job[]> {
    const queue = this.getQueue(queueName)
    return queue.getFailed(start, end)
  }

  /**
   * Retries a failed job.
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName)
    const job = await queue.getJob(jobId)
    if (job) {
      await job.retry()
    }
  }

  /**
   * Obliterates a queue - removes all jobs and data.
   * Use with caution!
   */
  async obliterateQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName)
    await queue.obliterate()
    this.queues.delete(queueName)
  }

  /**
   * Start persistent workers that consume jobs from queues.
   *
   * Creates one BullMQ Worker per task, each processing jobs from its
   * respective queue. Workers use the connector's prefix and connection.
   *
   * @returns Handle to stop all workers and check running status
   */
  async listen(params: {
    tasks: Array<{
      taskName: string
      handle: (data: unknown) => Promise<unknown>
      concurrency?: number
    }>
    defaultConcurrency?: number
  }): Promise<{ stop: () => Promise<void>; isRunning: () => boolean }> {
    const { tasks, defaultConcurrency = DEFAULT_CONCURRENCY } = params
    const workers: Worker[] = []

    for (const task of tasks) {
      const concurrency = task.concurrency ?? defaultConcurrency
      const workerKey = `${this._prefix}:${task.taskName}`
      const worker = new Worker(
        task.taskName,
        async (job: Job) => task.handle(job.data),
        {
          connection: this.connectionOptions,
          concurrency,
          prefix: this._prefix,
        },
      )
      this.workers.set(workerKey, worker)
      workers.push(worker)
    }

    // Give workers time to connect to Redis
    await new Promise(resolve => setTimeout(resolve, 1000))

    let running = true
    return {
      stop: async () => {
        await Promise.all(workers.map(w => w.close()))
        for (const task of tasks) {
          this.workers.delete(`${this._prefix}:${task.taskName}`)
        }
        running = false
      },
      isRunning: () => running && workers.every(w => !w.closing),
    }
  }

  /**
   * Process incoming dispatch work for this tenant's queues.
   *
   * v2 — parallel batched processing:
   *  - Pulls `batchSize` jobs in parallel per inner iteration (vs 1-by-1)
   *  - Runs handlers in parallel via Promise.allSettled (vs sequential await)
   *  - Acks all results in parallel (vs sequential)
   *  - Concurrency cap chunks the batch when handler resources are limited
   *
   * Backwards compatible: behaviour at low load (batchSize=1) is identical
   * to v1. Default batchSize=50 means notification-style queues see 10-50×
   * throughput improvement under bursts. High-throughput batched queues
   * (engine ingest, where the handler is itself a batched accumulator) can
   * pass batchSize=200 to fill the accumulator's threshold.
   *
   * Critical invariants preserved from v1:
   *  - One ephemeral Worker per queue (no persistent per-tenant workers)
   *  - waitUntilReady() before any getNextJob (the v1 race-condition fix)
   *  - tempWorker.close() in finally (no leaked connections)
   *  - Hinted queue prioritised (moved to front of queueNames)
   *  - Per-job try/catch — one handler failure doesn't abort the batch
   *  - moveToCompleted/Failed signature unchanged
   */
  async processIncomingDispatch(params: {
    handleTask: (queueName: string, data: unknown) => Promise<unknown>
    timeBudgetMs?: number
    validQueueNames?: Set<string>
    batchSize?: number
    concurrency?: number
    hint?: {
      tenantId?: string
      queueName?: string
      jobId?: string
      data?: unknown
    }
  }): Promise<{ processed: number; failed: number }> {
    const { handleTask, timeBudgetMs = 25_000, validQueueNames, hint } = params
    const batchSize = Math.max(1, params.batchSize ?? 50)
    const concurrency = Math.max(
      1,
      Math.min(params.concurrency ?? batchSize, batchSize),
    )
    const deadline = Date.now() + timeBudgetMs
    let processed = 0
    let failed = 0

    // Determine which queues to drain (unchanged from v1)
    const queueNames = validQueueNames
      ? [...validQueueNames]
      : hint?.queueName
        ? [hint.queueName]
        : []

    // Prioritize the hinted queue (move to front) (unchanged from v1)
    if (hint?.queueName && queueNames.includes(hint.queueName)) {
      const idx = queueNames.indexOf(hint.queueName)
      if (idx > 0) {
        queueNames.splice(idx, 1)
        queueNames.unshift(hint.queueName)
      }
    }

    for (const queueName of queueNames) {
      if (Date.now() >= deadline) {
        break
      }

      const tempWorker = new Worker(queueName, undefined as any, {
        connection: this.getSharedConnection(),
        prefix: this._prefix,
        autorun: false,
      })

      try {
        // Wait for the Worker's ioredis connection to be ready before
        // calling getNextJob — otherwise it hangs or silently returns null
        // when there's connection latency, auth delay, or TLS negotiation.
        // (Existing fix from v1; just as critical for parallel calls.)
        await tempWorker.waitUntilReady()

        while (Date.now() < deadline) {
          // ── PARALLEL PULL ─────────────────────────────────────────
          // Issue `batchSize` getNextJob calls in parallel. Each returns
          // a Job or null. We filter nulls — that's how we know the queue
          // is drained for now.
          //
          // Note: BullMQ's getNextJob is atomic (Lua script), so multiple
          // parallel calls won't return the same job to two callers.
          const pulled = await Promise.all(
            Array.from({ length: batchSize }, () =>
              tempWorker.getNextJob('dispatch'),
            ),
          )
          const jobs = pulled.filter(
            (j): j is NonNullable<typeof j> => j != null,
          )
          if (jobs.length === 0) {
            break // queue empty
          }

          // ── PARALLEL HANDLER INVOCATION (chunked by concurrency) ──
          // For batchSize > concurrency we process in chunks so we don't
          // exceed the requested in-flight cap. For batchSize === concurrency
          // (default) the chunking is a no-op single batch.
          //
          // Promise.allSettled — one handler failure must NOT abort the rest;
          // each job gets its own ack/fail decision below.
          type HandlerResult =
            | { ok: true; value: unknown }
            | { ok: false; error: Error }
          const results: HandlerResult[] = new Array(jobs.length)

          for (let off = 0; off < jobs.length; off += concurrency) {
            const chunk = jobs.slice(off, off + concurrency)
            const settled = await Promise.allSettled(
              chunk.map(j => handleTask(queueName, j.data)),
            )
            for (let i = 0; i < settled.length; i++) {
              const r = settled[i]!
              results[off + i] =
                r.status === 'fulfilled'
                  ? { ok: true, value: r.value }
                  : {
                      ok: false,
                      error:
                        r.reason instanceof Error
                          ? r.reason
                          : new Error(String(r.reason)),
                    }
            }
          }

          // ── PARALLEL ACK ──────────────────────────────────────────
          // moveToCompleted/Failed signature: (returnValue, token, fetchNext).
          // We pass fetchNext=false because we explicitly drive job pulling
          // in the next iteration's getNextJob calls.
          //
          // Promise.allSettled here too — if one ack fails (e.g. PG hiccup
          // in sodium's task handler that already wrote to PG before the
          // handler returned), we don't want to lose track of the others.
          const ackResults = await Promise.allSettled(
            jobs.map((j, i): Promise<unknown> => {
              const r = results[i]!
              if (r.ok === true) {
                return j.moveToCompleted(
                  r.value,
                  j.token || '0',
                  false,
                ) as Promise<unknown>
              }
              return j.moveToFailed(
                r.error,
                j.token || '0',
                false,
              ) as Promise<unknown>
            }),
          )

          // Tally — count ack success, not handler success, since a job
          // whose handler succeeded but whose ack failed will be retried
          // by BullMQ's stalled-job recovery (correct behaviour).
          for (let i = 0; i < jobs.length; i++) {
            if (ackResults[i]!.status === 'rejected') {
              // Ack failed — log via stderr (no logger here) and skip tally
              // BullMQ stalled-job recovery will redeliver
              // eslint-disable-next-line no-console
              console.error(
                `[BullMQConnector] processIncomingDispatch: ack failed for job ${jobs[i]!.id} on ${queueName}`,
                (ackResults[i] as PromiseRejectedResult).reason,
              )
            } else if (results[i]!.ok) {
              processed++
            } else {
              failed++
            }
          }
        }
      } finally {
        await tempWorker.close()
      }
    }

    return { processed, failed }
  }
}
