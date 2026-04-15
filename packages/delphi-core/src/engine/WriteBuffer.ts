// Generic write-buffer accumulator (Hatchet pattern).
//
// Per Hatchet's perf docs (https://docs.hatchet.run/self-hosting/improving-performance),
// they run separate write buffers per write-type — workflow runs, events, step
// dispatches, semaphore releases — each tuned independently. Latency-sensitive
// writes flush every 100ms / 500 items; fire-and-forget writes (events) flush
// every 1000ms / 1000 items.
//
// This class is the shared primitive: caller provides a flushFn(items[]) that
// performs the batched write (COPY FROM, batched INSERT, batched UPDATE, etc.)
// and the buffer handles snapshot-and-swap, threshold/interval triggers,
// jitter, bounded concurrent flushes, and re-prepend on failure.
//
// npx vitest run src/__tests__/engine/write-buffer.spec.ts

export interface WriteBufferConfig<T> {
  /** Where the batched items go — must be idempotent on retry. */
  flushFn: (items: T[]) => Promise<void>
  /** Flush when buffer reaches this many items. Default 200. */
  flushThreshold?: number
  /** Flush at least every N ms (with optional jitter). Default 100ms. */
  flushIntervalMs?: number
  /** Random jitter added to the interval to avoid N-instance thundering herd. Default 20ms. */
  maxJitterMs?: number
  /**
   * Max concurrent in-flight flushes. Each flush typically holds a PG client,
   * so cap below pool size. Default 1 (sequential, simplest).
   */
  maxConcurrentFlushes?: number
  /** Optional name for log lines / metrics. */
  name?: string
  logger?: {
    info?: (...a: unknown[]) => void
    error?: (...a: unknown[]) => void
  }
}

export class WriteBuffer<T> {
  private buffer: T[] = []
  private inFlight = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private shuttingDown = false

  private readonly cfg: Required<
    Omit<WriteBufferConfig<T>, 'logger' | 'name'>
  > &
    Pick<WriteBufferConfig<T>, 'logger' | 'name'>

  constructor(config: WriteBufferConfig<T>) {
    this.cfg = {
      flushFn: config.flushFn,
      flushThreshold: config.flushThreshold ?? 200,
      flushIntervalMs: config.flushIntervalMs ?? 100,
      maxJitterMs: config.maxJitterMs ?? 20,
      maxConcurrentFlushes: config.maxConcurrentFlushes ?? 1,
      logger: config.logger,
      name: config.name,
    }
    this.scheduleNext()
  }

  /** Add an item to the buffer. Triggers an immediate flush if the threshold is reached. */
  enqueue(item: T): void {
    if (this.shuttingDown) {
      throw new Error(
        `WriteBuffer${this.cfg.name ? `[${this.cfg.name}]` : ''} is shutting down`,
      )
    }
    this.buffer.push(item)
    if (
      this.buffer.length >= this.cfg.flushThreshold &&
      this.inFlight < this.cfg.maxConcurrentFlushes
    ) {
      void this.flush()
    }
  }

  /** Add many items at once. Triggers a flush at most once even if threshold is exceeded. */
  enqueueMany(items: T[]): void {
    if (this.shuttingDown) {
      throw new Error(
        `WriteBuffer${this.cfg.name ? `[${this.cfg.name}]` : ''} is shutting down`,
      )
    }
    this.buffer.push(...items)
    if (
      this.buffer.length >= this.cfg.flushThreshold &&
      this.inFlight < this.cfg.maxConcurrentFlushes
    ) {
      void this.flush()
    }
  }

  /** Force a flush now; resolves once flushed (or queued behind in-flight flushes). */
  async flushNow(): Promise<void> {
    await this.flush()
  }

  /** Stop the timer and drain any remaining items. */
  async shutdown(): Promise<void> {
    this.shuttingDown = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    while (this.buffer.length > 0 || this.inFlight > 0) {
      await this.flush()
      if (this.inFlight > 0) {
        await new Promise(r => setTimeout(r, 10))
      }
    }
  }

  /** Current depth (untyped — for /health endpoints and metrics). */
  currentDepth(): number {
    return this.buffer.length
  }

  inFlightCount(): number {
    return this.inFlight
  }

  private scheduleNext(): void {
    if (this.shuttingDown) {
      return
    }
    const jitter = Math.floor(Math.random() * this.cfg.maxJitterMs)
    this.timer = setTimeout(() => {
      void this.flush().finally(() => this.scheduleNext())
    }, this.cfg.flushIntervalMs + jitter)
    if (this.timer.unref) {
      this.timer.unref()
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return
    }
    if (this.inFlight >= this.cfg.maxConcurrentFlushes) {
      return
    }
    this.inFlight++

    // Atomic swap — this batch is owned by this flush call alone
    const batch = this.buffer
    this.buffer = []

    try {
      await this.cfg.flushFn(batch)
    } catch (err) {
      // Re-prepend on failure so we don't drop writes (same pattern as
      // the legacy logBuffer). Note: if flushFn is non-idempotent, the
      // caller should wrap in their own retry/dedupe logic.
      this.buffer.unshift(...batch)
      this.cfg.logger?.error?.(
        `WriteBuffer${this.cfg.name ? `[${this.cfg.name}]` : ''} flush failed; re-prepended ${batch.length} items`,
        err,
      )
    } finally {
      this.inFlight--
      // If pending grew past threshold while we were in-flight, kick another flush
      if (
        this.buffer.length >= this.cfg.flushThreshold &&
        this.inFlight < this.cfg.maxConcurrentFlushes
      ) {
        void this.flush()
      }
    }
  }
}
