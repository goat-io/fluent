// npx vitest run src/__tests__/broker/broker-e2e.spec.ts
//
// BrokerHandlers — HTTP endpoint handlers for the agent protocol.
// 6 endpoints: register, next-job (long-poll), step-result, step-failed, heartbeat, deregister.
//
import { createHash, randomBytes } from 'node:crypto'
import { Ids } from '@goatlab/js-utils'
import type { Kysely } from 'kysely'
import type { Database } from '../entities/Database.js'
import type { StepResult } from '../workflow/WorkflowBuilder.types.js'
import type {
  AgentCapabilities,
  AgentRegistry,
  RegisteredAgent,
} from './AgentRegistry.js'
import type { WorkerBroker } from './WorkerBroker.js'

// Simple hash for token comparison (not bcrypt for now — registration tokens are short-lived)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface BrokerHandlersConfig {
  db: Kysely<Database>
  registry: AgentRegistry
  broker?: WorkerBroker
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

export function createBrokerHandlers(config: BrokerHandlersConfig) {
  const { db, registry, logger } = config

  return {
    /**
     * POST /agents/token — Admin generates a registration token (24h TTL, single-use).
     */
    async generateAgentToken(input: { tenantId: string }): Promise<{
      registrationToken: string
      expiresAt: string
    }> {
      const token = randomBytes(32).toString('hex')
      const id = Ids.nanoId(21)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

      await db
        .insertInto('agent_tokens')
        .values({
          id,
          tenantId: input.tenantId,
          token: hashToken(token),
          used: false,
          usedBy: null,
          expiresAt,
        })
        .execute()

      logger?.info(
        `Agent registration token generated for tenant ${input.tenantId}`,
      )
      return { registrationToken: token, expiresAt: expiresAt.toISOString() }
    },

    /**
     * POST /agents/register — Exchange registration token for agent identity.
     * Agent provides a self-generated secret that gets hashed and stored.
     */
    async register(input: {
      tenantId: string
      name: string
      hostname: string
      capabilities: AgentCapabilities
      registrationToken: string
      secret: string
      maxConcurrent?: number
    }): Promise<{ agentId: string }> {
      const tokenHash = hashToken(input.registrationToken)
      const secretHash = hashToken(input.secret)

      // Check if this is a re-registration (agent reconnecting after backend restart)
      // If we already have an agent with this secret in-memory, just return it
      for (const agent of registry.listAgents(input.tenantId)) {
        if (agent.secretHash === secretHash) {
          logger?.info(`Agent re-registered: ${agent.name} (${agent.id})`)
          // Update worker_nodes heartbeat
          await db
            .updateTable('worker_nodes' as any)
            .set({ status: 'active', lastHeartbeatAt: new Date() } as any)
            .where('id' as any, '=', agent.id)
            .execute()
            .catch(() => {})
          return { agentId: agent.id }
        }
      }

      // Validate token for new registration
      const tokenRow = await db
        .selectFrom('agent_tokens')
        .selectAll()
        .where('token', '=', tokenHash)
        .where('tenantId', '=', input.tenantId)
        .executeTakeFirst()

      if (!tokenRow) {
        throw new Error('Invalid registration token')
      }
      if (tokenRow.used && tokenRow.usedBy) {
        // Token was used before — this is a reconnect after backend restart.
        // Verify the incoming secret matches the one stored at first registration
        // so a leaked used token alone isn't enough to impersonate the agent.
        const prior = await db
          .selectFrom('worker_nodes')
          .select(['secretHash'])
          .where('id', '=', tokenRow.usedBy)
          .where('tenantId', '=', input.tenantId)
          .executeTakeFirst()
        // Reject with a single generic message so we don't leak whether the
        // failure is a missing worker_nodes row, a legacy row without stored
        // hash, or a genuine secret mismatch.
        if (
          !prior ||
          prior.secretHash == null ||
          prior.secretHash !== secretHash
        ) {
          throw new Error('Registration token already used')
        }
        logger?.info(`Agent reconnecting with used token: ${input.name}`)
      } else if (
        tokenRow.expiresAt &&
        new Date(tokenRow.expiresAt) < new Date()
      ) {
        throw new Error('Registration token expired')
      }

      // Register in-memory
      const agent = registry.registerAgent({
        tenantId: input.tenantId,
        name: input.name,
        hostname: input.hostname,
        capabilities: input.capabilities,
        secretHash,
        maxConcurrent: input.maxConcurrent,
      })

      // Mark token as used
      await db
        .updateTable('agent_tokens')
        .set({ used: true, usedBy: agent.id })
        .where('id', '=', tokenRow.id)
        .execute()

      // Insert into worker_nodes table so it shows in the Workers UI.
      // secretHash is persisted so cross-restart reconnects can be authenticated.
      await db
        .insertInto('worker_nodes' as any)
        .values({
          id: agent.id,
          tenantId: input.tenantId,
          name: input.name,
          hostname: input.hostname,
          capabilities: JSON.stringify(input.capabilities),
          secretHash,
          status: 'active',
          lastHeartbeatAt: new Date(),
          registeredAt: new Date(),
        } as any)
        .execute()

      logger?.info(
        `Agent registered: ${input.name} (${agent.id}) for tenant ${input.tenantId}`,
      )
      return { agentId: agent.id }
    },

    /**
     * POST /agents/next-job — Long-poll for the next available job.
     * Blocks up to timeoutMs (default 30s). Returns null if no job available.
     */
    async nextJob(input: {
      agentId: string
      secret: string
      timeoutMs?: number
    }): Promise<{
      job: {
        id: string
        type: 'step' | 'task'
        queue: string
        payload: Record<string, unknown>
      } | null
    }> {
      const agent = verifyAgent(registry, input.agentId, input.secret)
      const timeout = Math.min(input.timeoutMs ?? 30_000, 60_000)
      const deadline = Date.now() + timeout

      // Poll with backoff: 50ms, 100ms, 200ms... capped at 1s
      let delay = 50
      while (Date.now() < deadline) {
        const job = registry.getNextJob(agent.id)
        if (job) {
          return {
            job: {
              id: job.id,
              type: job.type,
              queue: job.queue,
              payload: job.payload,
            },
          }
        }
        await new Promise(r => setTimeout(r, Math.min(delay, 1000)))
        delay = Math.min(delay * 2, 1000)
      }

      return { job: null }
    },

    /**
     * POST /agents/step-started — Agent reports it began executing a job.
     */
    async stepStarted(input: {
      agentId: string
      secret: string
      jobId: string
    }): Promise<{ success: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      registry.markStarted(input.jobId)
      return { success: true }
    },

    /**
     * POST /agents/step-result — Agent reports successful completion.
     * Idempotent: returns accepted=false if already completed.
     */
    async stepResult(input: {
      agentId: string
      secret: string
      jobId: string
      result: StepResult
    }): Promise<{ accepted: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      const accepted = registry.completeJob(
        input.agentId,
        input.jobId,
        input.result,
      )
      return { accepted }
    },

    /**
     * POST /agents/step-failed — Agent reports failure.
     * Idempotent: returns accepted=false if already completed.
     */
    async stepFailed(input: {
      agentId: string
      secret: string
      jobId: string
      error: string
    }): Promise<{ accepted: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      const accepted = registry.failJob(input.agentId, input.jobId, input.error)
      return { accepted }
    },

    /**
     * POST /agents/heartbeat — Agent liveness signal.
     * Returns job IDs the agent should abort.
     */
    async heartbeat(input: {
      agentId: string
      secret: string
    }): Promise<{ status: string; cancelJobIds: string[]; queues?: string[] }> {
      const agent = verifyAgent(registry, input.agentId, input.secret)
      const result = registry.heartbeat(input.agentId)

      // Keep DB row in sync for the Workers UI
      await db
        .updateTable('worker_nodes' as any)
        .set({ lastHeartbeatAt: new Date() } as any)
        .where('id' as any, '=', input.agentId)
        .execute()
        .catch(() => {})

      // Check if queues changed in DB (admin toggled via UI)
      let queues: string[] | undefined
      try {
        const row = (await db
          .selectFrom('worker_nodes' as any)
          .selectAll()
          .where('id' as any, '=', input.agentId)
          .executeTakeFirst()) as any
        if (row?.capabilities) {
          const caps = JSON.parse(row.capabilities)
          const currentQueues = agent.capabilities.queues
          if (
            JSON.stringify(caps.queues?.sort()) !==
            JSON.stringify(currentQueues?.sort())
          ) {
            queues = caps.queues
            // Update in-memory registry
            agent.capabilities.queues = caps.queues
          }
        }
      } catch {}

      return { status: agent.status, cancelJobIds: result.cancelJobIds, queues }
    },

    /**
     * POST /agents/deregister — Graceful disconnect.
     */
    async deregister(input: {
      agentId: string
      secret: string
    }): Promise<{ success: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      registry.removeAgent(input.agentId)

      // Mark DB row offline for the Workers UI
      await db
        .updateTable('worker_nodes' as any)
        .set({ status: 'offline' } as any)
        .where('id' as any, '=', input.agentId)
        .execute()
        .catch(() => {})

      logger?.info(`Agent deregistered: ${input.agentId}`)
      return { success: true }
    },
  }
}

// ── Auth Helper ─────────────────────────────────────────────────

function verifyAgent(
  registry: AgentRegistry,
  agentId: string,
  secret: string,
): RegisteredAgent {
  const agent = registry.getAgent(agentId)
  if (!agent) {
    throw new Error('Unknown agent')
  }

  const secretHash = hashToken(secret)
  if (secretHash !== agent.secretHash) {
    throw new Error('Invalid agent secret')
  }

  return agent
}

export type BrokerHandlers = ReturnType<typeof createBrokerHandlers>
