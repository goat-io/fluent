// npx vitest run src/__tests__/broker/broker-e2e.spec.ts
//
// AgentDaemon — remote agent process that speaks HTTPS only.
// Long-polls the broker for jobs, executes them locally, reports results.
// No Redis. No Postgres. Outbound HTTPS on port 443 only.
//
import { randomBytes } from 'node:crypto'
import os from 'node:os'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type { StepPayload } from '../workflow/WorkflowBuilder.types.js'
import type { AgentCapabilities } from './AgentRegistry.js'

export interface AgentDaemonConfig {
  brokerUrl: string
  registrationToken: string
  tenantId: string
  name?: string
  executors: Map<string, StepExecutor>
  maxConcurrent?: number
  heartbeatIntervalMs?: number
  pollTimeoutMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

export class AgentDaemon {
  private agentId: string | null = null
  private secret: string
  private running = false
  private activeJobs = new Map<string, AbortController>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private config: Required<
    Pick<
      AgentDaemonConfig,
      'brokerUrl' | 'registrationToken' | 'tenantId' | 'executors'
    >
  > &
    AgentDaemonConfig

  constructor(config: AgentDaemonConfig) {
    this.config = {
      ...config,
      name: config.name ?? os.hostname(),
      maxConcurrent: config.maxConcurrent ?? 5,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 30_000,
      pollTimeoutMs: config.pollTimeoutMs ?? 30_000,
    }
    this.secret = randomBytes(32).toString('hex')
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    const capabilities = this.detectCapabilities()
    this.config.logger?.info(`Agent starting: ${this.config.name}`)
    this.config.logger?.info(`Capabilities: ${JSON.stringify(capabilities)}`)

    // 1. Register with broker
    const res = await this.post('/agents/register', {
      tenantId: this.config.tenantId,
      name: this.config.name,
      hostname: os.hostname(),
      capabilities,
      registrationToken: this.config.registrationToken,
      secret: this.secret,
      maxConcurrent: this.config.maxConcurrent,
    })

    this.agentId = res.agentId
    this.running = true
    this.config.logger?.info(`Registered as agent ${this.agentId}`)

    // 2. Start heartbeat loop
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(err => {
        this.config.logger?.error('Heartbeat failed:', err.message)
      })
    }, this.config.heartbeatIntervalMs)

    // 3. Start poll loop (non-blocking)
    this.pollLoop().catch(err => {
      this.config.logger?.error('Poll loop crashed:', err.message)
    })
  }

  async stop(): Promise<void> {
    this.running = false

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Abort all active jobs
    for (const [, controller] of this.activeJobs) {
      controller.abort()
    }

    // Wait for active jobs to drain (give them 5s)
    const deadline = Date.now() + 5_000
    while (this.activeJobs.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100))
    }

    // Deregister
    if (this.agentId) {
      try {
        await this.post('/agents/deregister', {
          agentId: this.agentId,
          secret: this.secret,
        })
        this.config.logger?.info('Deregistered')
      } catch {
        // Best effort
      }
    }
  }

  // ── Poll Loop ────────────────────────────────────────────────

  private async pollLoop(): Promise<void> {
    let backoffMs = 1_000

    while (this.running) {
      // Don't poll if at capacity
      if (this.activeJobs.size >= (this.config.maxConcurrent ?? 5)) {
        await new Promise(r => setTimeout(r, 100))
        continue
      }

      try {
        const res = await this.post('/agents/next-job', {
          agentId: this.agentId,
          secret: this.secret,
          timeoutMs: this.config.pollTimeoutMs,
        })

        if (res.job) {
          backoffMs = 1_000 // Reset backoff on success
          // Spawn execution (don't await — parallel)
          this.executeJob(res.job).catch(err => {
            this.config.logger?.error(
              `Job ${res.job.id} execution error:`,
              err.message,
            )
          })
        }
        // If no job, immediately re-poll (long-poll already waited)
      } catch (err: any) {
        this.config.logger?.error(
          `Poll error: ${err.message}, retrying in ${backoffMs}ms`,
        )
        await new Promise(r => setTimeout(r, backoffMs))
        backoffMs = Math.min(backoffMs * 2, 30_000) // Cap at 30s
      }
    }
  }

  // ── Job Execution ────────────────────────────────────────────

  private async executeJob(job: {
    id: string
    type: 'step' | 'task'
    queue: string
    payload: Record<string, unknown>
  }): Promise<void> {
    const controller = new AbortController()
    this.activeJobs.set(job.id, controller)

    try {
      // Report step started
      await this.post('/agents/step-started', {
        agentId: this.agentId,
        secret: this.secret,
        jobId: job.id,
      })

      // Find executor
      const payload = job.payload as StepPayload
      const executor = this.config.executors.get(payload.executorType)
      if (!executor) {
        throw new Error(
          `No executor registered for type "${payload.executorType}"`,
        )
      }

      // Execute (no context — remote agents don't have engine/DB access)
      const result = await executor.execute(payload)

      // Check if aborted
      if (controller.signal.aborted) {
        return
      }

      // Report success
      await this.post('/agents/step-result', {
        agentId: this.agentId,
        secret: this.secret,
        jobId: job.id,
        result,
      })
    } catch (err: any) {
      if (controller.signal.aborted) {
        return
      }

      // Report failure
      try {
        await this.post('/agents/step-failed', {
          agentId: this.agentId,
          secret: this.secret,
          jobId: job.id,
          error: err.message ?? String(err),
        })
      } catch {
        // Best effort
      }
    } finally {
      this.activeJobs.delete(job.id)
    }
  }

  // ── Heartbeat ────────────────────────────────────────────────

  private async sendHeartbeat(): Promise<void> {
    if (!this.agentId || !this.running) {
      return
    }

    const res = await this.post('/agents/heartbeat', {
      agentId: this.agentId,
      secret: this.secret,
    })

    // Abort jobs the broker has timed out
    if (res.cancelJobIds?.length > 0) {
      for (const jobId of res.cancelJobIds) {
        const controller = this.activeJobs.get(jobId)
        if (controller) {
          this.config.logger?.warn(`Aborting timed-out job: ${jobId}`)
          controller.abort()
          this.activeJobs.delete(jobId)
        }
      }
    }

    // Handle drain request
    if (res.status === 'draining') {
      this.config.logger?.info(
        'Broker requested drain — stopping after current jobs',
      )
      this.running = false
    }
  }

  // ── Capability Detection ─────────────────────────────────────

  private detectCapabilities(): AgentCapabilities {
    const cpuCount = os.cpus().length
    const memoryMB = Math.floor(os.totalmem() / (1024 * 1024))

    let dockerAvailable = false
    try {
      const { execSync } = require('node:child_process')
      execSync('docker info', { stdio: 'ignore', timeout: 5_000 })
      dockerAvailable = true
    } catch {
      // Docker not available
    }

    const queues: string[] = ['workflow_step_light']
    if (memoryMB >= 4096) {
      queues.push('workflow_step_heavy')
    }
    queues.push('workflow_step_ai')
    if (dockerAvailable) {
      queues.push('workflow_step_sandbox')
    }

    return {
      cpuCount,
      memoryMB,
      dockerAvailable,
      gpuAvailable: false,
      queues,
    }
  }

  // ── HTTP Helper ──────────────────────────────────────────────

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<any> {
    const url = `${this.config.brokerUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${res.status} ${res.statusText}: ${text}`)
    }
    return res.json()
  }
}
