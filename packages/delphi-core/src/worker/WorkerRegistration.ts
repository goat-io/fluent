import cluster from 'node:cluster'
import { randomUUID } from 'node:crypto'
import { cpus, hostname, totalmem } from 'node:os'
import type { DbClient } from '../db/DbClient.js'
import { toJson } from '../entities/Database.js'

export interface WorkerSelfRegistrationConfig {
  db: DbClient
  name?: string
  tenantId?: string | null
  accountId?: string | null
  heartbeatMs?: number
  capabilities?: {
    cpuCount?: number
    memoryMB?: number
    gpuAvailable?: boolean
    dockerAvailable?: boolean
    queues?: string[]
    labels?: string[]
    [key: string]: unknown
  }
}

export class WorkerSelfRegistration {
  private readonly db: DbClient
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
    this.workerName =
      config.name ?? `${hostname()}:${process.pid}${clusterSuffix}`
    this.tenantId = config.tenantId ?? null
    this.accountId = config.accountId ?? null
    this.heartbeatMs = config.heartbeatMs ?? 30_000

    const workerCount =
      Number.parseInt(process.env.DELPHI_WORKER_COUNT || '1', 10) || 1
    const machineMemMB = Math.round(totalmem() / 1024 / 1024)
    const envLabels = process.env.DELPHI_WORKER_LABELS
      ? process.env.DELPHI_WORKER_LABELS.split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : undefined
    this.capabilities = {
      cpuCount: 1,
      memoryMB: Math.round(machineMemMB / workerCount),
      machineCpuCount: cpus().length,
      machineMemoryMB: machineMemMB,
      labels: envLabels,
      ...config.capabilities,
    }
  }

  async register(): Promise<string> {
    const id = randomUUID()

    try {
      await this.db.query(
        `UPDATE worker_nodes SET status = $1 WHERE hostname = $2 AND status = $3`,
        ['offline', hostname(), 'active'],
      )
    } catch {
      // Non-critical
    }

    await this.db.query(
      `INSERT INTO worker_nodes (id, "tenantId", "accountId", name, hostname, capabilities, status, "lastHeartbeatAt", "registeredAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        this.tenantId,
        this.accountId,
        this.workerName,
        hostname(),
        toJson(this.capabilities),
        'active',
        new Date(),
        new Date(),
      ],
    )

    this.workerId = id

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => {})
    }, this.heartbeatMs)

    return id
  }

  async heartbeat(): Promise<void> {
    if (!this.workerId) {
      return
    }
    await this.db.query(
      `UPDATE worker_nodes SET "lastHeartbeatAt" = $1 WHERE id = $2`,
      [new Date(), this.workerId],
    )
  }

  async deregister(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.workerId) {
      await this.db
        .query(`UPDATE worker_nodes SET status = $1 WHERE id = $2`, [
          'offline',
          this.workerId,
        ])
        .catch(() => {})
      this.workerId = null
    }
  }

  getId(): string | null {
    return this.workerId
  }

  getName(): string {
    return this.workerName
  }
}
