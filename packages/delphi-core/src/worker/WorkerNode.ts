// npx vitest run src/__tests__/engine/worker-node.spec.ts

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import { WorkflowStepTask } from '../tasks/WorkflowStepTask.js'
import type { StepPayload } from '../workflow/WorkflowBuilder.types.js'
import type {
  WorkerCapabilities,
  WorkerNodeConfig,
} from './WorkerNode.types.js'

export class WorkerNode {
  private config: Required<
    Pick<WorkerNodeConfig, 'heartbeatIntervalMs' | 'name'>
  > &
    WorkerNodeConfig
  private capabilities: WorkerCapabilities | null = null
  private status: 'idle' | 'active' | 'draining' | 'offline' = 'idle'
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private workerId: string | null = null
  private stopWorker: (() => Promise<void>) | null = null

  constructor(config?: WorkerNodeConfig) {
    const envConfig: WorkerNodeConfig = {
      redisUrl: process.env.AGENTS_REDIS_URL,
      redisHost: process.env.AGENTS_REDIS_HOST,
      redisPort: process.env.AGENTS_REDIS_PORT
        ? Number(process.env.AGENTS_REDIS_PORT)
        : undefined,
      engineUrl: process.env.AGENTS_ENGINE_URL,
      workerToken: process.env.AGENTS_WORKER_TOKEN,
      tenantId: process.env.AGENTS_TENANT_ID,
      name: process.env.AGENTS_WORKER_NAME,
    }

    this.config = {
      ...envConfig,
      ...config,
      heartbeatIntervalMs: config?.heartbeatIntervalMs ?? 30_000,
      name: config?.name ?? envConfig.name ?? os.hostname(),
    }
  }

  /** Detect system resources */
  detectResources(): WorkerCapabilities {
    if (this.capabilities && !this.config.capabilities) {
      return this.capabilities
    }

    const cpuCount = os.cpus().length
    const memoryMB = Math.floor(os.totalmem() / (1024 * 1024))

    let dockerAvailable = false
    try {
      const dockerPaths = [
        process.env.DOCKER_HOST?.replace('unix://', ''),
        `${process.env.HOME}/.docker/run/docker.sock`,
        '/var/run/docker.sock',
        '/run/docker.sock',
      ].filter(Boolean) as string[]
      dockerAvailable =
        dockerPaths.some(p => existsSync(p)) ||
        (() => {
          try {
            execSync('docker info', { stdio: 'ignore', timeout: 5000 })
            return true
          } catch {
            return false
          }
        })()
    } catch {
      dockerAvailable = false
    }

    let gpuAvailable = false
    try {
      execSync('nvidia-smi', { stdio: 'ignore', timeout: 5000 })
      gpuAvailable = true
    } catch {
      /* no GPU */
    }

    const base: WorkerCapabilities = {
      cpuCount,
      memoryMB,
      dockerAvailable,
      gpuAvailable,
      queues: [],
    }

    // Apply overrides from config
    if (this.config.capabilities) {
      if (this.config.capabilities.cpuCount !== undefined) {
        base.cpuCount = this.config.capabilities.cpuCount
      }
      if (this.config.capabilities.memoryMB !== undefined) {
        base.memoryMB = this.config.capabilities.memoryMB
      }
      if (this.config.capabilities.dockerAvailable !== undefined) {
        base.dockerAvailable = this.config.capabilities.dockerAvailable
      }
      if (this.config.capabilities.gpuAvailable !== undefined) {
        base.gpuAvailable = this.config.capabilities.gpuAvailable
      }
    }

    base.queues = this.getQueueSubscriptions(base).map(q => q.taskName)
    this.capabilities = base
    return base
  }

  /** Determine which queues to subscribe to based on capabilities */
  getQueueSubscriptions(
    caps?: WorkerCapabilities,
  ): Array<{ taskName: string; concurrency: number }> {
    const c = caps ?? this.detectResources()
    const subs: Array<{ taskName: string; concurrency: number }> = []

    // Always subscribe to light queue
    subs.push({ taskName: 'workflow_step_light', concurrency: c.cpuCount * 2 })

    // Heavy queue only if enough memory (>4GB)
    if (c.memoryMB > 4096) {
      subs.push({ taskName: 'workflow_step_heavy', concurrency: 2 })
    }

    // Always subscribe to AI queue
    subs.push({ taskName: 'workflow_step_ai', concurrency: 3 })

    // Sandbox queue only if Docker is available
    if (c.dockerAvailable) {
      subs.push({ taskName: 'workflow_step_sandbox', concurrency: 1 })
    }

    return subs
  }

  /**
   * Get recommended concurrency adjustments based on queue depths.
   * Call periodically (e.g., every 30s) to adapt to load.
   */
  async getRecommendedConcurrency(
    getQueueDepth: (queueName: string) => Promise<number>,
  ): Promise<Array<{ taskName: string; concurrency: number }>> {
    const subs = this.getQueueSubscriptions()
    const adjusted = []

    for (const sub of subs) {
      const depth = await getQueueDepth(sub.taskName)
      let concurrency = sub.concurrency

      if (depth > 100) {
        concurrency = Math.min(sub.concurrency * 3, 50)
      } else if (depth > 20) {
        concurrency = Math.min(sub.concurrency * 2, 30)
      } else if (depth === 0) {
        concurrency = Math.max(Math.floor(sub.concurrency / 2), 1)
      }

      adjusted.push({ taskName: sub.taskName, concurrency })
    }

    return adjusted
  }

  /**
   * Start processing jobs.
   * Creates a WorkflowStepTask, subscribes to appropriate queues via the connector,
   * registers with the engine, and starts heartbeat.
   */
  async start(engine: WorkflowEngine, connector: any): Promise<void> {
    this.status = 'active'
    const caps = this.detectResources()
    const subs = this.getQueueSubscriptions(caps)

    // Subscribe to queues if a real connector is provided
    if (connector && typeof connector.listen === 'function') {
      const stepTask = new WorkflowStepTask(engine)
      if (typeof stepTask.setConnector === 'function') {
        stepTask.setConnector(connector)
      }

      const tasks = subs.map(sub => ({
        taskName: sub.taskName,
        handle: (data: unknown) => stepTask.handle(data as StepPayload),
        concurrency: sub.concurrency,
      }))

      const listenHandle = await connector.listen({ tasks })
      this.stopWorker = listenHandle.stop
    }

    // Register with engine via API if engineUrl is set
    if (this.config.engineUrl) {
      try {
        const regResponse = await fetch(
          `${this.config.engineUrl}/workers/register`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.workerToken
                ? { Authorization: `Bearer ${this.config.workerToken}` }
                : {}),
            },
            body: JSON.stringify({
              tenantId: this.config.tenantId ?? 'default',
              name: this.config.name,
              hostname: os.hostname(),
              capabilities: caps,
            }),
          },
        )
        const body = (await regResponse.json()) as { workerId: string }
        this.workerId = body.workerId
      } catch (err) {
        // Registration failure is non-fatal — worker can still process jobs
        console.warn(
          `[WorkerNode] Failed to register with engine: ${(err as Error).message}`,
        )
      }
    }

    // Start heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(() => {})
    }, this.config.heartbeatIntervalMs)

    console.log(
      `[WorkerNode] ${this.config.name} started — queues: ${subs.map(s => `${s.taskName}(${s.concurrency})`).join(', ')}`,
    )
  }

  /**
   * Graceful shutdown: stop accepting new jobs, drain in-flight, deregister.
   */
  async stop(): Promise<void> {
    this.status = 'draining'

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Stop accepting new jobs and wait for in-flight to complete
    if (this.stopWorker) {
      await this.stopWorker()
      this.stopWorker = null
    }

    // Deregister from engine
    if (this.workerId && this.config.engineUrl) {
      try {
        await fetch(`${this.config.engineUrl}/workers/deregister`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.workerToken
              ? { Authorization: `Bearer ${this.config.workerToken}` }
              : {}),
          },
          body: JSON.stringify({ workerId: this.workerId }),
        })
      } catch {
        // Deregistration failure is non-fatal
      }
    }

    this.status = 'offline'
    this.workerId = null
    console.log(`[WorkerNode] ${this.config.name} stopped`)
  }

  /** Get current worker info */
  getInfo(): {
    name: string
    capabilities: WorkerCapabilities
    status: string
    workerId: string | null
    config: Partial<WorkerNodeConfig>
  } {
    return {
      name: this.config.name,
      capabilities: this.capabilities ?? this.detectResources(),
      status: this.status,
      workerId: this.workerId,
      config: {
        redisUrl: this.config.redisUrl,
        redisHost: this.config.redisHost,
        redisPort: this.config.redisPort,
        engineUrl: this.config.engineUrl,
        tenantId: this.config.tenantId,
        heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      },
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.workerId || !this.config.engineUrl) {
      return
    }

    await fetch(`${this.config.engineUrl}/workers/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.workerToken
          ? { Authorization: `Bearer ${this.config.workerToken}` }
          : {}),
      },
      body: JSON.stringify({ workerId: this.workerId }),
    })
  }
}
