// npx vitest run src/__tests__/engine/worker-node.spec.ts
import { randomUUID } from 'node:crypto'
import type {
  WorkerCapabilities,
  WorkerRegistration,
} from './WorkerNode.types.js'

export interface WorkerProvisioner {
  provision(
    name: string,
    tenantId: string,
    capabilities: WorkerCapabilities,
  ): Promise<WorkerRegistration>
  deprovision(workerId: string): Promise<void>
  listWorkers(tenantId: string): Promise<WorkerRegistration[]>
}

/**
 * In-memory worker provisioner for development and testing.
 */
export class LocalWorkerProvisioner implements WorkerProvisioner {
  private workers = new Map<string, WorkerRegistration>()

  async provision(
    name: string,
    _tenantId: string,
    capabilities: WorkerCapabilities,
  ): Promise<WorkerRegistration> {
    const now = new Date().toISOString()
    const reg: WorkerRegistration = {
      id: randomUUID(),
      name,
      capabilities,
      status: 'active',
      registeredAt: now,
      lastHeartbeatAt: now,
    }
    this.workers.set(reg.id, reg)
    return reg
  }

  async deprovision(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.status = 'offline'
    }
  }

  async listWorkers(_tenantId: string): Promise<WorkerRegistration[]> {
    return Array.from(this.workers.values())
  }

  /** Update heartbeat timestamp */
  async heartbeat(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.lastHeartbeatAt = new Date().toISOString()
    }
  }
}
