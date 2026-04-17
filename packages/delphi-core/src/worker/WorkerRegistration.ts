import { hostname, cpus, totalmem } from 'os'
import { randomUUID } from 'crypto'
import cluster from 'node:cluster'
import type { Kysely } from 'kysely'
import type { Database } from '../entities/Database.js'
import { toJson } from '../entities/Database.js'

export interface WorkerSelfRegistrationConfig {
  db: Kysely<Database>
  /** Worker name. Defaults to hostname:pid */
  name?: string
  /** Tenant scope. null = global (serves all tenants) */
  tenantId?: string | null
  /** Account scope. null = not account-scoped */
  accountId?: string | null
  /** Heartbeat interval in ms. Default: 30000 */
  heartbeatMs?: number
  /** Worker capabilities. Omitted fields auto-detected. */
  capabilities?: {
    cpuCount?: number
    memoryMB?: number
    gpuAvailable?: boolean
    dockerAvailable?: boolean
    queues?: string[]
    [key: string]: unknown
  }
}

export class WorkerSelfRegistration {
  private readonly db: Kysely<Database>
  private readonly workerName: string
  private readonly tenantId: string | null
  private readonly accountId: string | null
  private readonly heartbeatMs: number
  private readonly capabilities: Record<string, unknown>

  private workerId: string | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: WorkerSelfRegistrationConfig) {
    this.db = config.db
    const clusterSuffix = cluster.isWorker
      ? `:w${process.env.DELPHI_WORKER_INDEX ?? cluster.worker?.id ?? ''}`
      : ''
    this.workerName = config.name ?? `${hostname()}:${process.pid}${clusterSuffix}`
    this.tenantId = config.tenantId ?? null
    this.accountId = config.accountId ?? null
    this.heartbeatMs = config.heartbeatMs ?? 30_000

    // Auto-detect capabilities for this process.
    // Each cluster fork gets 1 CPU core and an equal share of machine RAM.
    // Node cluster forks don't share memory — each has its own V8 heap.
    const workerCount = parseInt(process.env.DELPHI_WORKER_COUNT || '1', 10) || 1
    const machineMemMB = Math.round(totalmem() / 1024 / 1024)
    this.capabilities = {
      cpuCount: 1,
      memoryMB: Math.round(machineMemMB / workerCount),
      machineCpuCount: cpus().length,
      machineMemoryMB: machineMemMB,
      ...config.capabilities,
    }
  }

  /** Register this worker and start heartbeat. */
  async register(): Promise<string> {
    const id = randomUUID()

    // Clean up stale workers from the same hostname (previous restarts/crashes)
    try {
      await this.db
        .updateTable('worker_nodes')
        .set({ status: 'offline' })
        .where('hostname', '=', hostname())
        .where('status', '=', 'active')
        .execute()
    } catch {
      // Non-critical — old entries will expire via heartbeat timeout
    }

    await this.db
      .insertInto('worker_nodes')
      .values({
        id,
        tenantId: this.tenantId,
        accountId: this.accountId,
        name: this.workerName,
        hostname: hostname(),
        capabilities: toJson(this.capabilities),
        status: 'active',
        lastHeartbeatAt: new Date(),
        registeredAt: new Date(),
      })
      .execute()

    this.workerId = id

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => {})
    }, this.heartbeatMs)

    return id
  }

  /** Send a heartbeat to keep the worker alive. */
  async heartbeat(): Promise<void> {
    if (!this.workerId) return
    await this.db
      .updateTable('worker_nodes')
      .set({ lastHeartbeatAt: new Date() })
      .where('id', '=', this.workerId)
      .execute()
  }

  /** Mark worker offline and stop heartbeat. */
  async deregister(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.workerId) {
      await this.db
        .updateTable('worker_nodes')
        .set({ status: 'offline' })
        .where('id', '=', this.workerId)
        .execute()
        .catch(() => {})
      this.workerId = null
    }
  }

  /** Get the registered worker ID, or null if not registered. */
  getId(): string | null {
    return this.workerId
  }

  /** Get the worker name. */
  getName(): string {
    return this.workerName
  }
}
