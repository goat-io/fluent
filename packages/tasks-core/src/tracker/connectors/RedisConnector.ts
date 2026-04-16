/**
 * RedisTaskTrackerConnector
 *
 * Production-ready Redis implementation with:
 * - High-throughput batch operations via pipelines
 * - Real-time Pub/Sub for SSE updates
 * - TTL-based automatic cleanup
 * - Multi-tenant key isolation
 *
 * Key patterns (with default keyPrefix "task"):
 * - Task state: task:{tenantId}:{taskId} (Hash)
 * - Owner index: task:{tenantId}:owner:{ownerId} (Set)
 * - Pub/Sub channel: task-updates:{tenantId}:{taskId}
 *
 * Requires ioredis as a peer dependency.
 */

import type {
  ListByOwnerOptions,
  TaskStateCallback,
  TaskTrackerConnector,
  TrackedTaskState,
  Unsubscribe,
} from '../tracker.types'

/**
 * Minimal Redis interface to avoid hard dependency on ioredis.
 * Users pass their own Redis instances.
 */
export interface RedisClient {
  hset(key: string, data: Record<string, string | number>): Promise<number>
  hgetall(key: string): Promise<Record<string, string>>
  expire(key: string, seconds: number): Promise<number>
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string): Promise<void>
  unsubscribe(channel: string): Promise<void>
  on(
    event: 'message',
    handler: (channel: string, message: string) => void,
  ): void
  off(
    event: 'message',
    handler: (channel: string, message: string) => void,
  ): void
  pipeline(): RedisPipeline
  quit(): Promise<void>
  /** Add member(s) to a set */
  sadd(key: string, ...members: string[]): Promise<number>
  /** Get all members of a set */
  smembers(key: string): Promise<string[]>
}

export interface RedisPipeline {
  hset(key: string, data: Record<string, string | number>): RedisPipeline
  expire(key: string, seconds: number): RedisPipeline
  sadd(key: string, ...members: string[]): RedisPipeline
  exec(): Promise<[Error | null, unknown][]>
}

export interface RedisTaskTrackerSharedClients {
  redis: RedisClient
  subscriber: RedisClient
}

export interface RedisTaskTrackerConfig {
  /**
   * TTL in seconds for completed tasks.
   * @default 86400 (24 hours)
   */
  completedTTL?: number

  /**
   * TTL in seconds for failed tasks.
   * @default 604800 (7 days)
   */
  failedTTL?: number

  /**
   * Default TTL in seconds for tasks (before completion).
   * @default 86400 (24 hours)
   */
  defaultTTL?: number

  /**
   * Key prefix for task storage.
   * @default 'task'
   */
  keyPrefix?: string

  /**
   * Channel prefix for Pub/Sub.
   * @default 'task-updates'
   */
  channelPrefix?: string
}

const DEFAULT_CONFIG: Required<RedisTaskTrackerConfig> = {
  completedTTL: 86400,
  failedTTL: 604800,
  defaultTTL: 86400,
  keyPrefix: 'task',
  channelPrefix: 'task-updates',
}

export class RedisTaskTrackerConnector implements TaskTrackerConnector {
  private readonly redis: RedisClient
  private readonly subscriber: RedisClient
  private readonly config: Required<RedisTaskTrackerConfig>
  private readonly subscriptions: Map<string, Set<TaskStateCallback>> =
    new Map()
  /**
   * Tracks in-flight Redis SUBSCRIBE commands so that publish() can wait
   * for the subscription to be active before sending a message.
   * Without this, a publish() immediately after subscribe() races the async
   * Redis SUBSCRIBE command and the message is silently dropped.
   */
  private readonly pendingSubscriptions: Map<string, Promise<void>> = new Map()
  private messageHandler: ((channel: string, message: string) => void) | null =
    null

  /**
   * When true, the connector does NOT own the Redis clients and will not
   * call quit() on close. The caller is responsible for client lifecycle.
   * Set automatically when using `forTenant()`.
   */
  private readonly shared: boolean

  /**
   * Create a Redis connector.
   *
   * @param redis - Redis client for commands
   * @param subscriber - Separate Redis client for Pub/Sub subscriptions
   * @param config - Optional configuration
   */
  constructor(
    redis: RedisClient,
    subscriber: RedisClient,
    config?: RedisTaskTrackerConfig & { shared?: boolean },
  ) {
    this.redis = redis
    this.subscriber = subscriber
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.shared = config?.shared ?? false

    // Set up message handler for Pub/Sub
    this.setupMessageHandler()
  }

  /**
   * Create a tenant-scoped connector that shares the same Redis clients.
   * All connectors created this way reuse the parent's connections (O(1))
   * while isolating data via key/channel prefixes.
   *
   * When `clients` is provided (e.g., with tenant-specific Redis ACL credentials),
   * the connector uses those dedicated clients instead of the parent's.
   * This supports both shared-Redis (prefix isolation) and dedicated-Redis
   * (ACL isolation) deployments.
   *
   * @param tenantId - Used to build key and channel prefixes
   * @param options - Optional: basePrefix, dedicated Redis clients
   */
  forTenant(
    tenantId: string,
    options?: {
      /** Base prefix (default: 'tenant'). Keys become `{basePrefix}:{tenantId}:task` */
      basePrefix?: string
      /** Dedicated Redis clients for this tenant (e.g., with ACL credentials).
       *  When provided, the tenant connector owns these clients and will close them. */
      clients?: RedisTaskTrackerSharedClients
    },
  ): RedisTaskTrackerConnector {
    const basePrefix = options?.basePrefix ?? 'tenant'
    const dedicatedClients = options?.clients

    return new RedisTaskTrackerConnector(
      dedicatedClients?.redis ?? this.redis,
      dedicatedClients?.subscriber ?? this.subscriber,
      {
        keyPrefix: `${basePrefix}:${tenantId}:task`,
        channelPrefix: `${basePrefix}:${tenantId}:task`,
        completedTTL: this.config.completedTTL,
        failedTTL: this.config.failedTTL,
        defaultTTL: this.config.defaultTTL,
        // Shared = don't quit clients on close (parent owns them).
        // Dedicated = this connector owns the clients and should quit them.
        shared: !dedicatedClients,
      },
    )
  }

  /**
   * Generate the Redis key for a task.
   */
  private getKey(tenantId: string, taskId: string): string {
    return `${this.config.keyPrefix}:${tenantId}:${taskId}`
  }

  /**
   * Generate the Pub/Sub channel for a task.
   */
  private getChannel(tenantId: string, taskId: string): string {
    return `${this.config.channelPrefix}:${tenantId}:${taskId}`
  }

  /**
   * Generate the Redis key for the owner index.
   * Uses the same keyPrefix as task keys so all keys fall under
   * the same tenant ACL namespace (e.g., tenant:agrosocial:task:owner:...).
   */
  private getOwnerKey(tenantId: string, ownerId: string): string {
    return `${this.config.keyPrefix}:${tenantId}:owner:${ownerId}`
  }

  /**
   * Serialize a task state to Redis hash format.
   */
  private serializeState(
    state: TrackedTaskState,
  ): Record<string, string | number> {
    const data: Record<string, string | number> = {
      id: state.id,
      tenantId: state.tenantId,
      name: state.name,
      status: state.status,
      progress: state.progress,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    }

    if (state.message !== undefined) {
      data.message = state.message
    }
    if (state.error !== undefined) {
      data.error = state.error
    }
    if (state.completedAt !== undefined) {
      data.completedAt = state.completedAt
    }
    if (state.result !== undefined) {
      data.result = JSON.stringify(state.result)
    }
    if (state.ownerId !== undefined) {
      data.ownerId = state.ownerId
    }

    return data
  }

  /**
   * Deserialize a Redis hash to task state.
   */
  private deserializeState(
    data: Record<string, string>,
  ): TrackedTaskState | null {
    if (!data || Object.keys(data).length === 0) {
      return null
    }

    return {
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      status: data.status as TrackedTaskState['status'],
      progress: Number(data.progress),
      message: data.message || undefined,
      error: data.error || undefined,
      result: data.result ? JSON.parse(data.result) : undefined,
      ownerId: data.ownerId || undefined,
      createdAt: Number(data.createdAt),
      updatedAt: Number(data.updatedAt),
      completedAt: data.completedAt ? Number(data.completedAt) : undefined,
    }
  }

  /**
   * Get TTL based on task status.
   */
  private getTTL(status: TrackedTaskState['status']): number {
    switch (status) {
      case 'COMPLETED':
        return this.config.completedTTL
      case 'FAILED':
        return this.config.failedTTL
      default:
        return this.config.defaultTTL
    }
  }

  /**
   * Batch create multiple tasks using Redis pipeline.
   */
  async createBatch(tasks: TrackedTaskState[]): Promise<void> {
    if (tasks.length === 0) {
      return
    }

    const pipeline = this.redis.pipeline()

    for (const task of tasks) {
      const key = this.getKey(task.tenantId, task.id)
      const data = this.serializeState(task)
      const ttl = this.getTTL(task.status)

      pipeline.hset(key, data)
      pipeline.expire(key, ttl)

      // Add to owner index if ownerId is set
      if (task.ownerId) {
        const ownerKey = this.getOwnerKey(task.tenantId, task.ownerId)
        pipeline.sadd(ownerKey, task.id)
        pipeline.expire(ownerKey, this.config.defaultTTL)
      }
    }

    await pipeline.exec()
  }

  /**
   * Update a task's state.
   */
  async update(
    taskId: string,
    tenantId: string,
    updates: Partial<TrackedTaskState>,
  ): Promise<void> {
    const key = this.getKey(tenantId, taskId)

    const data: Record<string, string | number> = {}

    if (updates.status !== undefined) {
      data.status = updates.status
    }
    if (updates.progress !== undefined) {
      data.progress = updates.progress
    }
    if (updates.message !== undefined) {
      data.message = updates.message
    }
    if (updates.error !== undefined) {
      data.error = updates.error
    }
    if (updates.result !== undefined) {
      data.result = JSON.stringify(updates.result)
    }
    if (updates.completedAt !== undefined) {
      data.completedAt = updates.completedAt
    }
    data.updatedAt = updates.updatedAt ?? Date.now()

    await this.redis.hset(key, data)

    // Update TTL based on status
    if (updates.status) {
      const ttl = this.getTTL(updates.status)
      await this.redis.expire(key, ttl)
    }
  }

  /**
   * Get a task's current state.
   */
  async get(
    taskId: string,
    tenantId: string,
  ): Promise<TrackedTaskState | null> {
    const key = this.getKey(tenantId, taskId)
    const data = await this.redis.hgetall(key)
    return this.deserializeState(data)
  }

  /**
   * Publish a task state update via Pub/Sub.
   */
  async publish(
    tenantId: string,
    taskId: string,
    state: TrackedTaskState,
  ): Promise<void> {
    const channel = this.getChannel(tenantId, taskId)

    // Wait for any in-flight SUBSCRIBE on this channel to complete before
    // publishing, otherwise the message is silently dropped by Redis.
    const pending = this.pendingSubscriptions.get(channel)
    if (pending) {
      await pending
    }

    await this.redis.publish(channel, JSON.stringify(state))
  }

  /**
   * Set up the message handler for Pub/Sub.
   */
  private setupMessageHandler(): void {
    this.messageHandler = (channel: string, message: string) => {
      const callbacks = this.subscriptions.get(channel)
      if (!callbacks || callbacks.size === 0) {
        return
      }

      try {
        const state = JSON.parse(message) as TrackedTaskState
        for (const callback of callbacks) {
          try {
            callback(state)
          } catch (err) {
            console.error('[RedisTaskTracker] Callback error:', err)
          }
        }
      } catch (err) {
        console.error('[RedisTaskTracker] Failed to parse message:', err)
      }
    }

    this.subscriber.on('message', this.messageHandler)
  }

  /**
   * Subscribe to task state updates.
   */
  subscribe(
    tenantId: string,
    taskId: string,
    callback: TaskStateCallback,
  ): Unsubscribe {
    const channel = this.getChannel(tenantId, taskId)

    // Track subscription
    let callbacks = this.subscriptions.get(channel)
    if (!callbacks) {
      callbacks = new Set()
      this.subscriptions.set(channel, callbacks)
      // Subscribe to Redis channel and track the pending promise so that
      // publish() can wait for the subscription to be active.
      const pending = this.subscriber.subscribe(channel).then(
        () => {
          this.pendingSubscriptions.delete(channel)
        },
        () => {
          this.pendingSubscriptions.delete(channel)
        },
      )
      this.pendingSubscriptions.set(channel, pending)
    }
    callbacks.add(callback)

    // Return unsubscribe function
    return () => {
      callbacks!.delete(callback)
      if (callbacks!.size === 0) {
        this.subscriptions.delete(channel)
        this.subscriber.unsubscribe(channel)
      }
    }
  }

  /**
   * List all tasks for a specific owner.
   */
  async listByOwner(
    tenantId: string,
    ownerId: string,
    options?: ListByOwnerOptions,
  ): Promise<TrackedTaskState[]> {
    const ownerKey = this.getOwnerKey(tenantId, ownerId)
    const taskIds = await this.redis.smembers(ownerKey)

    if (taskIds.length === 0) {
      return []
    }

    // Batch get all tasks
    const tasks: TrackedTaskState[] = []
    for (const taskId of taskIds) {
      const task = await this.get(taskId, tenantId)
      if (task) {
        // Filter by status if specified
        if (options?.status) {
          const statuses = Array.isArray(options.status)
            ? options.status
            : [options.status]
          if (!statuses.includes(task.status)) {
            continue
          }
        }
        tasks.push(task)
      }
    }

    // Sort by createdAt descending (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt)

    // Apply limit
    const limit = options?.limit ?? 100
    return tasks.slice(0, limit)
  }

  /**
   * Clean up old tasks (Redis handles TTL automatically).
   * This method is provided for interface compliance.
   */
  async cleanup(_tenantId: string, _olderThanMs: number): Promise<number> {
    // Redis automatically cleans up via TTL
    return 0
  }

  /**
   * Close connections.
   * If this connector was created with `shared: true` (e.g., via `forTenant()`),
   * it only unsubscribes from its channels but does NOT quit the Redis clients,
   * since the parent connector owns the client lifecycle.
   */
  async close(): Promise<void> {
    // Remove message handler
    if (this.messageHandler) {
      this.subscriber.off('message', this.messageHandler)
      this.messageHandler = null
    }

    // Clear subscriptions
    for (const channel of this.subscriptions.keys()) {
      try {
        await this.subscriber.unsubscribe(channel)
      } catch {
        // Ignore errors from already closed connections
      }
    }
    this.subscriptions.clear()

    // Only close connections if we own them (not shared)
    if (!this.shared) {
      try {
        await this.subscriber.quit()
      } catch {
        // Ignore errors from already closed connections
      }

      try {
        await this.redis.quit()
      } catch {
        // Ignore errors from already closed connections
      }
    }
  }
}
