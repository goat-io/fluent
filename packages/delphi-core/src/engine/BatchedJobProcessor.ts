// BatchedJobProcessor — generic per-job-promise + accumulator + flush primitive.
//
// Captures the pattern shared by IngestWorker and StepStatusBuffer:
//   - enqueue() returns a promise per job
//   - jobs accumulate in an array
//   - flush triggers on threshold or interval
//   - per-job promises resolve only after the batch flush COMMITS
//   - bounded concurrent flushes
//
// Differs from WriteBuffer<T> (in this same directory):
//   - WriteBuffer: fire-and-forget, no per-item promise (used for log writes)
//   - BatchedJobProcessor: per-item promise, callers await commit (used for
//     IngestWorker, StepStatusBuffer — anything where BullMQ ack semantics
//     require knowing when the PG write actually committed)
//
// CRITICAL CONTRACT:
//   The promise returned by enqueue() resolves ONLY after the batch flush
//   completes successfully. If your flushFn returns/throws, the corresponding
//   per-job promise resolves/rejects — there is no other ordering guarantee.
//   Callers depending on "row is in PG when promise resolves" must ensure
//   their flushFn awaits the actual COMMIT.
//
// npx vitest run src/__tests__/engine/batched-job-processor.spec.ts

export interface BatchedJobProcessorConfig<TJob, TResult> {
  /**
   * Flush function. Called with the batched array of pending jobs.
   * MUST return an array of results in the same order as input — result[i]
   * corresponds to jobs[i] and resolves the promise that enqueue(jobs[i])
   * returned.
   *
   * If flushFn throws, ALL pending promises in the batch reject with the
   * same error (atomic batch — no partial success). If you need per-job
   * partial success, wrap inner errors in your TResult and resolve.
   */
  flushBatch: (jobs: TJob[]) => Promise<TResult[]>
  /** Flush when this many jobs are buffered. Default 100. */
  flushThreshold?: number
  /** Max ms to hold a job waiting for batch fill. Default 20ms. */
  flushIntervalMs?: number
  /**
   * Max concurrent in-flight flushes. Each flush typically holds external
   * resources (PG client, HTTP connection); cap below your resource budget.
   * Default 4.
   */
  maxConcurrentFlushes?: number
  /** Optional name for log lines. */
  name?: string
  logger?: {
    info?: (...a: unknown[]) => void
    error?: (...a: unknown[]) => void
  }
}

interface PendingEntry<TJob, TResult> {
  job: TJob
  resolve: (r: TResult) => void
  reject: (e: unknown) => void
}

export class BatchedJobProcessor<TJob, TResult = void> {
  private pending: PendingEntry<TJob, TResult>[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = 0
  private shuttingDown = false

  private readonly flushBatch: BatchedJobProcessorConfig<
    TJob,
    TResult
  >['flushBatch']
  private readonly flushThreshold: number
  private readonly flushIntervalMs: number
  private readonly maxConcurrentFlushes: number
  private readonly name: string
  private readonly logger?: BatchedJobProcessorConfig<TJob, TResult>['logger']

  constructor(config: BatchedJobProcessorConfig<TJob, TResult>) {
    this.flushBatch = config.flushBatch
    this.flushThreshold = config.flushThreshold ?? 100
    this.flushIntervalMs = config.flushIntervalMs ?? 20
    this.maxConcurrentFlushes = config.maxConcurrentFlushes ?? 4
    this.name = config.name ?? 'BatchedJobProcessor'
    this.logger = config.logger
  }

  /**
   * Enqueue a job. Returns a promise that resolves with the corresponding
   * result from flushBatch (or rejects if flushBatch throws).
   */
  enqueue(job: TJob): Promise<TResult> {
    if (this.shuttingDown) {
      return Promise.reject(new Error(`${this.name} is shutting down`))
    }
    return new Promise<TResult>((resolve, reject) => {
      this.pending.push({ job, resolve, reject })
      if (
        this.pending.length >= this.flushThreshold &&
        this.inFlight < this.maxConcurrentFlushes
      ) {
        this.triggerFlush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.triggerFlush(), this.flushIntervalMs)
        if (this.timer.unref) {
          this.timer.unref()
        }
      }
    })
  }

  /** Drain remaining pending items. For graceful shutdown. */
  async shutdown(): Promise<void> {
    this.shuttingDown = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    while (this.pending.length > 0 || this.inFlight > 0) {
      await this.flush()
      if (this.inFlight > 0) {
        await new Promise(r => setTimeout(r, 10))
      }
    }
  }

  /** Force a flush now. */
  async flushNow(): Promise<void> {
    await this.flush()
  }

  /** Diagnostics — count of jobs waiting to flush. */
  pendingCount(): number {
    return this.pending.length
  }

  /** Diagnostics — count of in-flight flushes. */
  inFlightCount(): number {
    return this.inFlight
  }

  private triggerFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // Fire-and-forget; per-job errors delivered via individual rejections
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.pending.length === 0) {
      return
    }
    if (this.inFlight >= this.maxConcurrentFlushes) {
      return
    }
    this.inFlight++

    // Atomic swap — this batch is owned by this flush call alone
    const batch = this.pending
    this.pending = []

    try {
      const jobs = batch.map(b => b.job)
      const results = await this.flushBatch(jobs)
      // Defense: if user's flushBatch returns wrong-sized array, treat as bug
      if (results.length !== batch.length) {
        const err = new Error(
          `${this.name}: flushBatch returned ${results.length} results for ${batch.length} jobs`,
        )
        for (const p of batch) {
          p.reject(err)
        }
        return
      }
      for (let i = 0; i < batch.length; i++) {
        batch[i]!.resolve(results[i] as TResult)
      }
    } catch (err) {
      this.logger?.error?.(
        `${this.name} flushBatch failed; rejecting batch of ${batch.length}`,
        err,
      )
      for (const p of batch) {
        p.reject(err)
      }
    } finally {
      this.inFlight--
      // If pending grew past threshold while we were in-flight, kick another flush
      if (
        this.pending.length >= this.flushThreshold &&
        this.inFlight < this.maxConcurrentFlushes
      ) {
        void this.flush()
      }
    }
  }
}
