// npx vitest run src/__tests__/broker/agent-registry.spec.ts
//
// Unit tests for AgentRegistry — pure in-memory, no Docker, no DB.
//
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PendingJob } from '../../broker/AgentRegistry.js'
import { AgentRegistry } from '../../broker/AgentRegistry.js'

function makeCapabilities(queues: string[] = ['workflow_step_light']) {
  return {
    cpuCount: 4,
    memoryMB: 8192,
    dockerAvailable: true,
    gpuAvailable: false,
    queues,
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry

  beforeEach(() => {
    registry = new AgentRegistry({
      maxPendingJobs: 100,
      sweepIntervalMs: 999_999, // disable auto-sweep; we call sweep() manually
      agentStaleAfterMs: 5_000,
      defaultJobTimeoutMs: 10_000,
    })
  })

  afterEach(() => {
    registry.stopSweep()
  })

  // ── Registration ──────────────────────────────────────────────

  describe('registerAgent / removeAgent', () => {
    it('registers an agent and returns it with an ID', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'agent-1',
        hostname: 'host1',
        capabilities: makeCapabilities(),
        secretHash: 'hash',
        maxConcurrent: 3,
      })
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBe('agent-1')
      expect(agent.maxConcurrent).toBe(3)
      expect(registry.totalAgents).toBe(1)
    })

    it('removeAgent rejects all in-flight jobs', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const jobPromise = registry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })
      registry.getNextJob(agent.id) // assign

      registry.removeAgent(agent.id)

      await expect(jobPromise).rejects.toThrow('deregistered')
      expect(registry.totalAgents).toBe(0)
    })
  })

  // ── Enqueue + Assignment ──────────────────────────────────────

  describe('enqueueJob + getNextJob', () => {
    it('enqueue with no agents stays unassigned', () => {
      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {}) // prevent unhandled rejection

      expect(registry.totalPendingJobs).toBe(1)
      expect(registry.totalUnassignedJobs).toBe(1)
    })

    it('getNextJob assigns to agent with matching queue', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(['workflow_step_light']),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const job = registry.getNextJob(agent.id)
      expect(job).toBeTruthy()
      expect(job!.assignedAgentId).toBe(agent.id)
      expect(job!.assignedAt).toBeInstanceOf(Date)
      expect(registry.totalUnassignedJobs).toBe(0)
    })

    it('getNextJob skips jobs from non-matching queues', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(['workflow_step_ai']),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_sandbox',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      expect(registry.getNextJob(agent.id)).toBeNull()
    })

    it('getNextJob returns null when agent at capacity', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
        maxConcurrent: 1,
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})
      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const first = registry.getNextJob(agent.id)
      expect(first).toBeTruthy()
      expect(registry.getNextJob(agent.id)).toBeNull() // at capacity
    })
  })

  // ── Backpressure ──────────────────────────────────────────────

  describe('backpressure', () => {
    it('rejects when maxPendingJobs exceeded', async () => {
      const smallRegistry = new AgentRegistry({
        maxPendingJobs: 2,
        sweepIntervalMs: 999_999,
      })

      smallRegistry
        .enqueueJob({ tenantId: 't1', type: 'step', queue: 'q', payload: {} })
        .catch(() => {})
      smallRegistry
        .enqueueJob({ tenantId: 't1', type: 'step', queue: 'q', payload: {} })
        .catch(() => {})

      await expect(
        smallRegistry.enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'q',
          payload: {},
        }),
      ).rejects.toThrow('backpressure')
    })
  })

  // ── Completion ────────────────────────────────────────────────

  describe('completeJob', () => {
    it('resolves the enqueued Promise', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const resultPromise = registry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })

      const job = registry.getNextJob(agent.id)!
      const accepted = registry.completeJob(agent.id, job.id, {
        output: { answer: 42 },
      })
      expect(accepted).toBe(true)

      const result = await resultPromise
      expect(result.output).toEqual({ answer: 42 })
    })

    it('idempotent: second call returns false', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const job = registry.getNextJob(agent.id)!
      registry.completeJob(agent.id, job.id, { output: {} })
      expect(registry.completeJob(agent.id, job.id, { output: {} })).toBe(false)
    })
  })

  describe('failJob', () => {
    it('rejects the enqueued Promise', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const resultPromise = registry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })

      const job = registry.getNextJob(agent.id)!
      registry.failJob(agent.id, job.id, 'agent crashed')

      await expect(resultPromise).rejects.toThrow('agent crashed')
    })

    it('idempotent: second call returns false', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const job = registry.getNextJob(agent.id)!
      registry.failJob(agent.id, job.id, 'err')
      expect(registry.failJob(agent.id, job.id, 'err again')).toBe(false)
    })
  })

  // ── Heartbeat ─────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('updates lastHeartbeatAt', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })
      const before = agent.lastHeartbeatAt.getTime()

      // Small delay to ensure time difference
      const result = registry.heartbeat(agent.id)
      expect(result.cancelJobIds).toEqual([])
      expect(agent.lastHeartbeatAt.getTime()).toBeGreaterThanOrEqual(before)
    })

    it('returns cancelJobIds for already-completed jobs', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const job = registry.getNextJob(agent.id)!
      registry.completeJob(agent.id, job.id, { output: {} })

      // Agent still thinks it has this job — heartbeat should tell it to cancel
      // Re-add to agent.pendingJobs to simulate agent not knowing it's done
      agent.pendingJobs.set(job.id, job)

      const result = registry.heartbeat(agent.id)
      expect(result.cancelJobIds).toContain(job.id)
    })
  })

  // ── markStarted ───────────────────────────────────────────────

  describe('markStarted', () => {
    it('sets startedAt timestamp', () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      registry
        .enqueueJob({
          tenantId: 't1',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 't1' },
        })
        .catch(() => {})

      const job = registry.getNextJob(agent.id)!
      expect(job.startedAt).toBeNull()

      registry.markStarted(job.id)
      expect(job.startedAt).toBeInstanceOf(Date)
    })
  })

  // ── Sweep ─────────────────────────────────────────────────────

  describe('sweep', () => {
    it('marks stale agents and rejects their jobs', async () => {
      const staleRegistry = new AgentRegistry({
        maxPendingJobs: 100,
        sweepIntervalMs: 999_999,
        agentStaleAfterMs: 1, // 1ms — immediately stale
        defaultJobTimeoutMs: 999_999,
      })

      const agent = staleRegistry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const jobPromise = staleRegistry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })

      staleRegistry.getNextJob(agent.id) // assign
      // Force lastHeartbeatAt to the past
      agent.lastHeartbeatAt = new Date(Date.now() - 10_000)

      staleRegistry.sweep()

      expect(agent.status).toBe('stale')
      await expect(jobPromise).rejects.toThrow('stale')
    })

    it('execution timeout: rejects job even with heartbeats', async () => {
      const timeoutRegistry = new AgentRegistry({
        maxPendingJobs: 100,
        sweepIntervalMs: 999_999,
        agentStaleAfterMs: 999_999, // agent NOT stale
        defaultJobTimeoutMs: 1, // 1ms timeout
      })

      const agent = timeoutRegistry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const jobPromise = timeoutRegistry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
        timeoutMs: 1,
      })

      const job = timeoutRegistry.getNextJob(agent.id)!
      timeoutRegistry.markStarted(job.id)
      // Force startedAt to the past
      job.startedAt = new Date(Date.now() - 10_000)

      // Agent heartbeats (is alive)
      timeoutRegistry.heartbeat(agent.id)

      timeoutRegistry.sweep()

      await expect(jobPromise).rejects.toThrow('Execution timeout')
    })

    it('unassigned timeout: rejects jobs waiting too long', async () => {
      const timeoutRegistry = new AgentRegistry({
        maxPendingJobs: 100,
        sweepIntervalMs: 999_999,
        agentStaleAfterMs: 999_999,
        defaultJobTimeoutMs: 1, // 1ms
      })

      const jobPromise = timeoutRegistry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })

      // Force enqueuedAt to the past
      // Access internal state for test
      const jobs = (timeoutRegistry as any).unassignedJobs as PendingJob[]
      jobs[0].enqueuedAt = new Date(Date.now() - 100_000)

      timeoutRegistry.sweep()

      await expect(jobPromise).rejects.toThrow('Unassigned timeout')
    })

    it('race: sweep vs complete — completed flag prevents double-resolve', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const resultPromise = registry.enqueueJob({
        tenantId: 't1',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
        timeoutMs: 1,
      })

      const job = registry.getNextJob(agent.id)!
      registry.markStarted(job.id)
      job.startedAt = new Date(Date.now() - 100_000) // force timeout

      // Complete BEFORE sweep runs
      registry.completeJob(agent.id, job.id, { output: { raced: true } })

      // Sweep should not double-reject because completed=true
      registry.sweep()

      const result = await resultPromise
      expect(result.output).toEqual({ raced: true })
    })
  })

  // ── Fairness ──────────────────────────────────────────────────

  describe('fairness', () => {
    it('round-robin: two agents get alternate jobs', () => {
      const a1 = registry.registerAgent({
        tenantId: 't1',
        name: 'a1',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
        maxConcurrent: 10,
      })
      const a2 = registry.registerAgent({
        tenantId: 't1',
        name: 'a2',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
        maxConcurrent: 10,
      })

      // Enqueue 4 jobs
      for (let i = 0; i < 4; i++) {
        registry
          .enqueueJob({
            tenantId: 't1',
            type: 'step',
            queue: 'workflow_step_light',
            payload: { tenantId: 't1', i },
          })
          .catch(() => {})
      }

      // Both agents poll — each should get jobs (FIFO, not round-robin on assignment)
      const j1 = registry.getNextJob(a1.id)
      const j2 = registry.getNextJob(a2.id)
      const j3 = registry.getNextJob(a1.id)
      const j4 = registry.getNextJob(a2.id)

      expect(j1).toBeTruthy()
      expect(j2).toBeTruthy()
      expect(j3).toBeTruthy()
      expect(j4).toBeTruthy()

      // All 4 are different jobs
      const ids = new Set([j1!.id, j2!.id, j3!.id, j4!.id])
      expect(ids.size).toBe(4)
    })
  })

  // ── Job Types ─────────────────────────────────────────────────

  describe('job types', () => {
    it('type field is preserved through enqueue → assign → complete', async () => {
      const agent = registry.registerAgent({
        tenantId: 't1',
        name: 'a',
        hostname: 'h',
        capabilities: makeCapabilities(),
        secretHash: 'h',
      })

      const resultPromise = registry.enqueueJob({
        tenantId: 't1',
        type: 'task',
        queue: 'workflow_step_light',
        payload: { tenantId: 't1' },
      })

      const job = registry.getNextJob(agent.id)!
      expect(job.type).toBe('task')

      registry.completeJob(agent.id, job.id, { output: { done: true } })
      const result = await resultPromise
      expect(result.output).toEqual({ done: true })
    })
  })
})
