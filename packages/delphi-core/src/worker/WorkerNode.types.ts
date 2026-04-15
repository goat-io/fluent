// npx vitest run src/__tests__/engine/worker-node.spec.ts

export interface WorkerNodeConfig {
  /** Redis connection URL (e.g. redis://localhost:6379) */
  redisUrl?: string
  /** Redis host (alternative to URL) */
  redisHost?: string
  redisPort?: number
  /** Engine API URL for registration/heartbeat */
  engineUrl?: string
  /** Worker auth token */
  workerToken?: string
  /** Worker name (defaults to hostname) */
  name?: string
  /** Tenant ID */
  tenantId?: string
  /** Override detected capabilities */
  capabilities?: Partial<WorkerCapabilities>
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs?: number
}

export interface WorkerCapabilities {
  cpuCount: number
  memoryMB: number
  dockerAvailable: boolean
  gpuAvailable: boolean
  /** Supported queue types based on capabilities */
  queues: string[]
}

export interface QueueDepthProvider {
  getQueueDepth(queueName: string): Promise<number>
}

export interface WorkerRegistration {
  id: string
  name: string
  capabilities: WorkerCapabilities
  status: 'active' | 'draining' | 'offline'
  registeredAt: string
  lastHeartbeatAt: string
}
