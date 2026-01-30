/**
 * IngestBuffer - Hatchet-style high-throughput buffering
 *
 * Batches items and flushes them periodically or when a threshold is reached.
 * Supports dynamic sizing based on backpressure (Fibonacci strategy).
 *
 * Performance target: 10K+ items/second
 */

export interface IngestBufferConfig {
  /**
   * Interval in milliseconds to flush the buffer.
   * @default 10
   */
  flushIntervalMs: number

  /**
   * Number of items to trigger an immediate flush.
   * @default 100
   */
  flushThreshold: number

  /**
   * Maximum concurrent flush operations.
   * @default 50
   */
  maxConcurrent: number

  /**
   * Buffer sizing strategy.
   * - STATIC: Always flush at flushThreshold
   * - DYNAMIC: Uses Fibonacci sizing based on concurrent flushes
   * @default 'DYNAMIC'
   */
  strategy: 'STATIC' | 'DYNAMIC'
}

const DEFAULT_CONFIG: IngestBufferConfig = {
  flushIntervalMs: 10,
  flushThreshold: 100,
  maxConcurrent: 50,
  strategy: 'DYNAMIC',
}

export class IngestBuffer<T> {
  private buffer: T[] = []
  private flushTimer?: ReturnType<typeof setTimeout>
  private concurrentFlushes = 0
  private readonly config: IngestBufferConfig
  private readonly flushFn: (items: T[]) => Promise<void>
  private _isClosed = false

  constructor(
    flushFn: (items: T[]) => Promise<void>,
    config?: Partial<IngestBufferConfig>,
  ) {
    this.flushFn = flushFn
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Add an item to the buffer.
   * May trigger an immediate flush if threshold is reached.
   */
  async add(item: T): Promise<void> {
    if (this._isClosed) {
      throw new Error('Buffer is closed')
    }

    this.buffer.push(item)

    if (this.shouldFlush()) {
      await this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  /**
   * Add multiple items to the buffer.
   */
  async addBatch(items: T[]): Promise<void> {
    if (this._isClosed) {
      throw new Error('Buffer is closed')
    }

    this.buffer.push(...items)

    if (this.shouldFlush()) {
      await this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  /**
   * Check if buffer should flush immediately.
   */
  private shouldFlush(): boolean {
    return this.buffer.length >= this.getTriggerSize()
  }

  /**
   * Get the threshold for triggering a flush.
   * Uses Fibonacci sizing when strategy is DYNAMIC.
   */
  private getTriggerSize(): number {
    if (this.config.strategy === 'STATIC') {
      return this.config.flushThreshold
    }

    // Dynamic: Fibonacci(concurrentFlushes) for backpressure
    // As more flushes are in progress, we wait for more items before flushing again
    return Math.min(
      this.fibonacci(this.concurrentFlushes + 1),
      this.config.flushThreshold,
    )
  }

  /**
   * Calculate Fibonacci number (for dynamic buffer sizing).
   * F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8, F(7)=13...
   */
  private fibonacci(n: number): number {
    if (n <= 2) {
      return 1
    }
    let a = 1
    let b = 1
    for (let i = 3; i <= n; i++) {
      const next = a + b
      a = b
      b = next
    }
    return b
  }

  /**
   * Flush the buffer immediately.
   */
  private async flush(): Promise<void> {
    // Check concurrency limit (backpressure)
    if (this.concurrentFlushes >= this.config.maxConcurrent) {
      // Schedule retry instead of blocking
      this.scheduleFlush()
      return
    }

    // Take all items from buffer
    const items = this.buffer.splice(0)
    if (items.length === 0) {
      return
    }

    this.concurrentFlushes++

    try {
      await this.flushFn(items)
    } catch (error) {
      // On error, put items back at the front of the buffer
      this.buffer.unshift(...items)
      console.error(
        '[IngestBuffer] Flush failed, items returned to buffer:',
        error,
      )
    } finally {
      this.concurrentFlushes--
    }
  }

  /**
   * Schedule a flush after the configured interval.
   */
  private scheduleFlush(): void {
    if (this.flushTimer || this._isClosed) {
      return
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      if (!this._isClosed) {
        this.flush()
      }
    }, this.config.flushIntervalMs)
  }

  /**
   * Get the number of items currently in the buffer.
   */
  get size(): number {
    return this.buffer.length
  }

  /**
   * Get the number of concurrent flush operations.
   */
  get pendingFlushes(): number {
    return this.concurrentFlushes
  }

  /**
   * Check if the buffer is closed.
   */
  get isClosed(): boolean {
    return this._isClosed
  }

  /**
   * Drain the buffer - flush all remaining items and close.
   * Call this on shutdown to ensure no data loss.
   */
  async drain(): Promise<void> {
    this._isClosed = true

    // Cancel scheduled flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }

    // Wait for concurrent flushes to complete
    while (this.concurrentFlushes > 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Final flush
    if (this.buffer.length > 0) {
      const items = this.buffer.splice(0)
      await this.flushFn(items)
    }
  }
}
