import { EventEmitter } from 'events'
import Redis from 'ioredis'

/**
 * Distributed Cache Invalidation System
 *
 * Handles cache invalidation across multiple backend instances using:
 * 1. Redis Pub/Sub for real-time invalidation
 * 2. Versioning for graceful degradation
 * 3. Event-driven architecture for decoupling
 */

export interface CacheInvalidationMessage {
  type: 'INVALIDATE_TENANT' | 'INVALIDATE_SERVICE' | 'INVALIDATE_ALL'
  tenantId?: string
  serviceType?: string
  reason?: string
  timestamp: number
  instanceId: string
}

export interface DistributedCacheOptions {
  redisUrl?: string
  channelPrefix?: string
  instanceId?: string
  enableFallback?: boolean
}

export class DistributedCacheInvalidator extends EventEmitter {
  private readonly redis: Redis
  private readonly subscriber: Redis
  private readonly channelPrefix: string
  private readonly instanceId: string
  private readonly enableFallback: boolean
  private heartbeatInterval?: ReturnType<typeof setInterval>

  private readonly INVALIDATION_CHANNEL = 'cache:invalidation'
  private readonly HEARTBEAT_CHANNEL = 'cache:heartbeat'
  private readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds

  constructor(options: DistributedCacheOptions = {}) {
    super()

    this.channelPrefix = options.channelPrefix || 'sodium'
    this.instanceId = options.instanceId || this.generateInstanceId()
    this.enableFallback = options.enableFallback ?? true

    // Create Redis connections
    const redisConfig =
      options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    this.redis = new Redis(redisConfig)
    this.subscriber = new Redis(redisConfig)

    this.setupSubscriptions()
    this.setupHeartbeat()
  }

  /**
   * Generate unique instance ID for this backend instance
   */
  private generateInstanceId(): string {
    const hostname = process.env.HOSTNAME || 'unknown'
    const pid = process.pid
    const timestamp = Date.now()
    return `${hostname}-${pid}-${timestamp}`
  }

  /**
   * Setup Redis pub/sub subscriptions
   */
  private setupSubscriptions(): void {
    const invalidationChannel = `${this.channelPrefix}:${this.INVALIDATION_CHANNEL}`
    const heartbeatChannel = `${this.channelPrefix}:${this.HEARTBEAT_CHANNEL}`

    // Subscribe to channels (fire-and-forget, will handle errors via event listeners)
    this.subscriber
      .subscribe(invalidationChannel, heartbeatChannel)
      .catch((err) => {
        console.error('Failed to subscribe to Redis channels:', err)
        if (this.enableFallback) {
          this.emit('redis-error', err)
        }
      })

    this.subscriber.on('message', (channel, message) => {
      try {
        if (channel === invalidationChannel) {
          this.handleInvalidationMessage(JSON.parse(message))
        } else if (channel === heartbeatChannel) {
          this.handleHeartbeatMessage(JSON.parse(message))
        }
      } catch (err) {
        console.error('Failed to process invalidation message:', err)
      }
    })

    this.subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error)
      if (this.enableFallback) {
        this.emit('redis-error', error)
      }
    })
  }

  /**
   * Setup heartbeat to monitor Redis connectivity
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat().catch(console.error)
    }, this.HEARTBEAT_INTERVAL)
  }

  /**
   * Send heartbeat to other instances
   */
  private async sendHeartbeat(): Promise<void> {
    const heartbeatChannel = `${this.channelPrefix}:${this.HEARTBEAT_CHANNEL}`
    const message = {
      instanceId: this.instanceId,
      timestamp: Date.now(),
      status: 'alive',
    }

    await this.redis.publish(heartbeatChannel, JSON.stringify(message))
  }

  /**
   * Handle incoming invalidation messages
   */
  private handleInvalidationMessage(message: CacheInvalidationMessage): void {
    // Ignore messages from this instance
    if (message.instanceId === this.instanceId) {
      return
    }

    console.log(
      `Received cache invalidation from ${message.instanceId}:`,
      message,
    )

    // Emit events for container to handle
    switch (message.type) {
      case 'INVALIDATE_TENANT':
        if (message.tenantId) {
          this.emit('invalidate-tenant', message.tenantId, message.reason)
        }
        break
      case 'INVALIDATE_SERVICE':
        if (message.serviceType) {
          this.emit('invalidate-service', message.serviceType, message.reason)
        }
        break
      case 'INVALIDATE_ALL':
        this.emit('invalidate-all', message.reason)
        break
    }
  }

  /**
   * Handle heartbeat messages (for monitoring)
   */
  private handleHeartbeatMessage(message: any): void {
    if (message.instanceId !== this.instanceId) {
      this.emit('instance-heartbeat', message)
    }
  }

  /**
   * Invalidate all cached data for a specific tenant across all instances
   */
  async invalidateTenant(tenantId: string, reason?: string): Promise<void> {
    const message: CacheInvalidationMessage = {
      type: 'INVALIDATE_TENANT',
      tenantId,
      reason: reason || 'Tenant credentials changed',
      timestamp: Date.now(),
      instanceId: this.instanceId,
    }

    await this.publishInvalidation(message)
  }

  /**
   * Invalidate all cached data for a specific service type across all instances
   */
  async invalidateService(serviceType: string, reason?: string): Promise<void> {
    const message: CacheInvalidationMessage = {
      type: 'INVALIDATE_SERVICE',
      serviceType,
      reason: reason || 'Service configuration changed',
      timestamp: Date.now(),
      instanceId: this.instanceId,
    }

    await this.publishInvalidation(message)
  }

  /**
   * Invalidate all cached data across all instances
   */
  async invalidateAll(reason?: string): Promise<void> {
    const message: CacheInvalidationMessage = {
      type: 'INVALIDATE_ALL',
      reason: reason || 'Global cache refresh',
      timestamp: Date.now(),
      instanceId: this.instanceId,
    }

    await this.publishInvalidation(message)
  }

  /**
   * Publish invalidation message to Redis
   */
  private async publishInvalidation(
    message: CacheInvalidationMessage,
  ): Promise<void> {
    const channel = `${this.channelPrefix}:${this.INVALIDATION_CHANNEL}`

    try {
      await this.redis.publish(channel, JSON.stringify(message))
      console.log(`Published invalidation message:`, message)
    } catch (err) {
      console.error('Failed to publish invalidation message:', err)

      if (this.enableFallback) {
        // Emit local invalidation as fallback
        this.emit('redis-publish-failed', err, message)
      }

      throw err
    }
  }

  /**
   * Get list of active instances (based on recent heartbeats)
   */
  async getActiveInstances(_maxAge: number = 60000): Promise<string[]> {
    // This would require storing heartbeat data in Redis
    // For now, return empty array as this is a monitoring feature
    return []
  }

  /**
   * Cleanup Redis connections
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    this.subscriber.disconnect()
    this.redis.disconnect()
  }
}

/**
 * Singleton instance for global use
 */
let globalInvalidator: DistributedCacheInvalidator | null = null

export function getDistributedCacheInvalidator(
  options?: DistributedCacheOptions,
): DistributedCacheInvalidator {
  if (!globalInvalidator) {
    globalInvalidator = new DistributedCacheInvalidator(options)
  }
  return globalInvalidator
}
