// npx vitest run src/__tests__/broker/agent-registry.spec.ts
//
// AgentRegistry — in-memory tracking of remote agents, pending jobs,
// backpressure, round-robin fairness, sweep for stale agents/timeouts.
//
import { nanoId } from '../db/ids.js'
import type { StepResult } from '../workflow/WorkflowBuilder.types.js'

// ── Types ─────────────────────────────────────────────────────────

export interface AgentCapabilities {
  cpuCount: number
  memoryMB: number
  dockerAvailable: boolean
  gpuAvailable: boolean
  queues: string[]
  /**
   * Free-form labels the worker advertises. When a step declares
   * `requiresLabels: [...]`, the scheduler will only route that step
   * to a worker whose labels are a superset (AND-match). Mirrors
   * GitHub Actions runner labels. Empty / unset = worker accepts any
   * step that matches its queues and other criteria.
   */
  labels?: string[]
}

export interface RegisteredAgent {
  id: string
  tenantId: string
  name: string
  hostname: string
  capabilities: AgentCapabilities
  secretHash: string
  status: 'connected' | 'draining' | 'stale'
  registeredAt: Date
  lastHeartbeatAt: Date
  pendingJobs: Map<string, PendingJob>
  maxConcurrent: number
  roundRobinCounter: number
}

export interface PendingJob {
  id: string
  type: 'step' | 'task'
  queue: string
  payload: Record<string, unknown>
  resolve: (result: StepResult) => void
  reject: (error: Error) => void
  completed: boolean
  enqueuedAt: Date
  assignedAgentId: string | null
  assignedAt: Date | null
  startedAt: Date | null
  timeoutMs: number
  /**
   * Labels the step requires on its runner (AND-match). Sourced from
   * the step definition's `requiresLabels`. When empty/undefined the
   * job runs on any worker whose queues match.
   */
  requiresLabels?: string[]
}

export interface AgentRegistryConfig {
  maxPendingJobs?: number
  sweepIntervalMs?: number
  agentStaleAfterMs?: number
  defaultJobTimeoutMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

// ── Registry ──────────────────────────────────────────────────────

export class AgentRegistry {
  private agents = new Map<string, RegisteredAgent>()
  private unassignedJobs: PendingJob[] = []
  private allJobs = new Map<string, PendingJob>()
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  private readonly maxPendingJobs: number
  private readonly sweepIntervalMs: number
  private readonly agentStaleAfterMs: number
  private readonly defaultJobTimeoutMs: number
  private readonly logger?: AgentRegistryConfig['logger']

  constructor(config?: AgentRegistryConfig) {
    this.maxPendingJobs = config?.maxPendingJobs ?? 10_000
    this.sweepIntervalMs = config?.sweepIntervalMs ?? 60_000
    this.agentStaleAfterMs = config?.agentStaleAfterMs ?? 90_000
    this.defaultJobTimeoutMs = config?.defaultJobTimeoutMs ?? 300_000
    this.logger = config?.logger
  }

  // ── Agent Lifecycle ──────────────────────────────────────────

  registerAgent(params: {
    tenantId: string
    name: string
    hostname: string
    capabilities: AgentCapabilities
    secretHash: string
    maxConcurrent?: number
  }): RegisteredAgent {
    const id = nanoId(21)
    const agent: RegisteredAgent = {
      id,
      tenantId: params.tenantId,
      name: params.name,
      hostname: params.hostname,
      capabilities: params.capabilities,
      secretHash: params.secretHash,
      status: 'connected',
      registeredAt: new Date(),
      lastHeartbeatAt: new Date(),
      pendingJobs: new Map(),
      maxConcurrent: params.maxConcurrent ?? 5,
      roundRobinCounter: 0,
    }
    this.agents.set(id, agent)
    this.logger?.info(`Agent registered: ${agent.name} (${id})`)
    return agent
  }

  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return
    }

    // Reject all in-flight jobs so BullMQ retries them
    for (const [, job] of agent.pendingJobs) {
      this.safeReject(job, new Error(`Agent ${agentId} deregistered`))
    }
    this.agents.delete(agentId)
    this.logger?.info(`Agent removed: ${agentId}`)
  }

  getAgent(agentId: string): RegisteredAgent | null {
    return this.agents.get(agentId) ?? null
  }

  listAgents(tenantId?: string): RegisteredAgent[] {
    const all = Array.from(this.agents.values())
    return tenantId ? all.filter(a => a.tenantId === tenantId) : all
  }

  // ── Job Enqueue ──────────────────────────────────────────────

  /**
   * Enqueue a job for dispatch to a remote agent.
   * Returns a Promise that resolves when the agent completes the job.
   * Rejects if: backpressure, timeout, agent stale, or agent failure.
   */
  enqueueJob(params: {
    tenantId: string
    type: 'step' | 'task'
    queue: string
    payload: Record<string, unknown>
    timeoutMs?: number
    /** Labels the runner must advertise. AND-matched in `getNextJob`. */
    requiresLabels?: string[]
  }): Promise<StepResult> {
    // Backpressure: hard cap on in-memory jobs
    if (this.allJobs.size >= this.maxPendingJobs) {
      return Promise.reject(
        new Error('Broker backpressure: too many pending jobs'),
      )
    }

    return new Promise<StepResult>((resolve, reject) => {
      const job: PendingJob = {
        id: nanoId(21),
        type: params.type,
        queue: params.queue,
        payload: params.payload,
        resolve,
        reject,
        completed: false,
        enqueuedAt: new Date(),
        assignedAgentId: null,
        assignedAt: null,
        startedAt: null,
        timeoutMs: params.timeoutMs ?? this.defaultJobTimeoutMs,
        requiresLabels: params.requiresLabels,
      }

      this.allJobs.set(job.id, job)
      this.unassignedJobs.push(job)
    })
  }

  // ── Job Assignment (long-poll) ───────────────────────────────

  /**
   * Get the next available job for an agent. Returns null if nothing available.
   * Respects agent's queue subscriptions and capacity.
   */
  getNextJob(agentId: string): PendingJob | null {
    const agent = this.agents.get(agentId)
    if (!agent || agent.status !== 'connected') {
      return null
    }

    // Capacity check
    if (agent.pendingJobs.size >= agent.maxConcurrent) {
      return null
    }

    // Find first unassigned job matching agent's queues (FIFO fairness)
    for (let i = 0; i < this.unassignedJobs.length; i++) {
      const job = this.unassignedJobs[i]

      // Skip completed jobs (sweep may have rejected them)
      if (job.completed) {
        this.unassignedJobs.splice(i, 1)
        i--
        continue
      }

      // Queue match
      if (!agent.capabilities.queues.includes(job.queue)) {
        continue
      }

      // Label match (AND-match). If the step declared required labels,
      // every one must be present in the agent's advertised labels.
      // Mirrors GitHub Actions `runs-on` — a runner must have all the
      // requested labels, not just one of them.
      if (job.requiresLabels && job.requiresLabels.length > 0) {
        const agentLabels = agent.capabilities.labels ?? []
        const missing = job.requiresLabels.some(l => !agentLabels.includes(l))
        if (missing) {
          continue
        }
      }

      // Tenant match
      const payload = job.payload as Record<string, unknown>
      if (payload.tenantId && payload.tenantId !== agent.tenantId) {
        continue
      }

      // Assign
      this.unassignedJobs.splice(i, 1)
      job.assignedAgentId = agentId
      job.assignedAt = new Date()
      agent.pendingJobs.set(job.id, job)
      agent.roundRobinCounter++

      return job
    }

    return null
  }

  // ── Job Completion ───────────────────────────────────────────

  /**
   * Complete a job. Returns false if already completed (idempotent).
   */
  completeJob(agentId: string, jobId: string, result: StepResult): boolean {
    const job = this.allJobs.get(jobId)
    if (!job || job.completed) {
      return false
    }

    job.completed = true
    job.resolve(result)
    this.cleanupJob(agentId, jobId)
    return true
  }

  /**
   * Fail a job. Returns false if already completed (idempotent).
   */
  failJob(agentId: string, jobId: string, errorMsg: string): boolean {
    const job = this.allJobs.get(jobId)
    if (!job || job.completed) {
      return false
    }

    this.safeReject(job, new Error(errorMsg))
    this.cleanupJob(agentId, jobId)
    return true
  }

  /**
   * Mark a job as started (agent began execution).
   */
  markStarted(jobId: string): void {
    const job = this.allJobs.get(jobId)
    if (job && !job.completed) {
      job.startedAt = new Date()
    }
  }

  // ── Heartbeat ────────────────────────────────────────────────

  /**
   * Agent heartbeat. Returns job IDs the agent should abort.
   */
  heartbeat(agentId: string): { cancelJobIds: string[] } {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return { cancelJobIds: [] }
    }

    agent.lastHeartbeatAt = new Date()
    agent.status = 'connected'

    // Find jobs assigned to this agent that we've already timed out/rejected
    const cancelJobIds: string[] = []
    for (const [jobId] of agent.pendingJobs) {
      const job = this.allJobs.get(jobId)
      if (!job || job.completed) {
        cancelJobIds.push(jobId)
        agent.pendingJobs.delete(jobId)
      }
    }

    return { cancelJobIds }
  }

  // ── Sweep ────────────────────────────────────────────────────

  startSweep(): void {
    if (this.sweepTimer) {
      return
    }
    this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs)
  }

  stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }

  /**
   * Periodic sweep: stale agents, execution timeouts, unassigned timeouts.
   */
  sweep(): void {
    const now = Date.now()

    // 1. Mark stale agents and reject their jobs
    for (const [, agent] of this.agents) {
      if (agent.status === 'stale') {
        continue
      }
      const sinceLast = now - agent.lastHeartbeatAt.getTime()
      if (sinceLast > this.agentStaleAfterMs) {
        this.logger?.warn(
          `Agent ${agent.id} (${agent.name}) stale — no heartbeat for ${sinceLast}ms`,
        )
        agent.status = 'stale'
        for (const [jobId, job] of agent.pendingJobs) {
          this.safeReject(
            job,
            new Error(`Agent stale: no heartbeat for ${sinceLast}ms`),
          )
          agent.pendingJobs.delete(jobId)
        }
      }
    }

    // 2. Execution timeout: assigned jobs where startedAt exceeded timeout
    for (const [, job] of this.allJobs) {
      if (job.completed) {
        continue
      }
      if (job.startedAt) {
        const elapsed = now - job.startedAt.getTime()
        if (elapsed > job.timeoutMs) {
          this.logger?.warn(
            `Job ${job.id} execution timeout after ${elapsed}ms`,
          )
          this.safeReject(
            job,
            new Error(`Execution timeout: ${elapsed}ms > ${job.timeoutMs}ms`),
          )
          if (job.assignedAgentId) {
            this.agents.get(job.assignedAgentId)?.pendingJobs.delete(job.id)
          }
        }
      }
    }

    // 3. Unassigned timeout: jobs waiting too long without assignment
    const unassignedTimeout = this.defaultJobTimeoutMs
    for (let i = this.unassignedJobs.length - 1; i >= 0; i--) {
      const job = this.unassignedJobs[i]
      if (job.completed) {
        this.unassignedJobs.splice(i, 1)
        continue
      }
      const waiting = now - job.enqueuedAt.getTime()
      if (waiting > unassignedTimeout) {
        this.safeReject(
          job,
          new Error(`Unassigned timeout: no agent for ${waiting}ms`),
        )
        this.unassignedJobs.splice(i, 1)
      }
    }

    // 4. Cleanup completed jobs from allJobs map (memory hygiene)
    for (const [id, job] of this.allJobs) {
      if (job.completed) {
        this.allJobs.delete(id)
      }
    }
  }

  // ── Metrics ──────────────────────────────────────────────────

  get totalPendingJobs(): number {
    return this.allJobs.size
  }

  get totalUnassignedJobs(): number {
    return this.unassignedJobs.length
  }

  get totalAgents(): number {
    return this.agents.size
  }

  // ── Private ──────────────────────────────────────────────────

  private safeReject(job: PendingJob, error: Error): void {
    if (job.completed) {
      return
    }
    job.completed = true
    job.reject(error)
  }

  private cleanupJob(agentId: string, jobId: string): void {
    this.allJobs.delete(jobId)
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.pendingJobs.delete(jobId)
    }
  }
}
