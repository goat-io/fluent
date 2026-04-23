// npx vitest run src/__tests__/broker/broker-e2e.spec.ts
//
// BrokerHandlers — HTTP endpoint handlers for the agent protocol.
//
import { createHash, randomBytes } from 'node:crypto'
import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { StepResult } from '../workflow/WorkflowBuilder.types.js'
import type {
  AgentCapabilities,
  AgentRegistry,
  RegisteredAgent,
} from './AgentRegistry.js'
import type { WorkerBroker } from './WorkerBroker.js'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface BrokerHandlersConfig {
  db: DbClient
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
    async generateAgentToken(input: { tenantId: string }): Promise<{
      registrationToken: string
      expiresAt: string
    }> {
      const token = randomBytes(32).toString('hex')
      const id = nanoId(21)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.query(
        `INSERT INTO agent_tokens (id, "tenantId", token, used, "usedBy", "expiresAt") VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, input.tenantId, hashToken(token), false, null, expiresAt],
      )

      logger?.info(
        `Agent registration token generated for tenant ${input.tenantId}`,
      )
      return { registrationToken: token, expiresAt: expiresAt.toISOString() }
    },

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

      for (const agent of registry.listAgents(input.tenantId)) {
        if (agent.secretHash === secretHash) {
          logger?.info(`Agent re-registered: ${agent.name} (${agent.id})`)
          await db
            .query(
              `UPDATE worker_nodes SET status = $1, "lastHeartbeatAt" = $2 WHERE id = $3`,
              ['active', new Date(), agent.id],
            )
            .catch(() => {})
          return { agentId: agent.id }
        }
      }

      const { rows: tokenRows } = await db.query(
        `SELECT * FROM agent_tokens WHERE token = $1 AND "tenantId" = $2`,
        [tokenHash, input.tenantId],
      )
      const tokenRow = tokenRows[0] as any

      if (!tokenRow) {
        throw new Error('Invalid registration token')
      }
      if (tokenRow.used && tokenRow.usedBy) {
        const { rows: priorRows } = await db.query<{
          secretHash: string | null
        }>(
          `SELECT "secretHash" FROM worker_nodes WHERE id = $1 AND "tenantId" = $2`,
          [tokenRow.usedBy, input.tenantId],
        )
        const prior = priorRows[0]
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

      const agent = registry.registerAgent({
        tenantId: input.tenantId,
        name: input.name,
        hostname: input.hostname,
        capabilities: input.capabilities,
        secretHash,
        maxConcurrent: input.maxConcurrent,
      })

      await db.query(
        `UPDATE agent_tokens SET used = $1, "usedBy" = $2 WHERE id = $3`,
        [true, agent.id, tokenRow.id],
      )

      await db.query(
        `INSERT INTO worker_nodes (id, "tenantId", name, hostname, capabilities, "secretHash", status, "lastHeartbeatAt", "registeredAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          agent.id,
          input.tenantId,
          input.name,
          input.hostname,
          JSON.stringify(input.capabilities),
          secretHash,
          'active',
          new Date(),
          new Date(),
        ],
      )

      logger?.info(
        `Agent registered: ${input.name} (${agent.id}) for tenant ${input.tenantId}`,
      )
      return { agentId: agent.id }
    },

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

    async stepStarted(input: {
      agentId: string
      secret: string
      jobId: string
    }): Promise<{ success: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      registry.markStarted(input.jobId)
      return { success: true }
    },

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

    async heartbeat(input: {
      agentId: string
      secret: string
    }): Promise<{ status: string; cancelJobIds: string[]; queues?: string[] }> {
      const agent = verifyAgent(registry, input.agentId, input.secret)
      const result = registry.heartbeat(input.agentId)

      await db
        .query(`UPDATE worker_nodes SET "lastHeartbeatAt" = $1 WHERE id = $2`, [
          new Date(),
          input.agentId,
        ])
        .catch(() => {})

      let queues: string[] | undefined
      try {
        const { rows } = await db.query(
          `SELECT * FROM worker_nodes WHERE id = $1`,
          [input.agentId],
        )
        const row = rows[0] as any
        if (row?.capabilities) {
          const caps = JSON.parse(row.capabilities)
          const currentQueues = agent.capabilities.queues
          if (
            JSON.stringify(caps.queues?.sort()) !==
            JSON.stringify(currentQueues?.sort())
          ) {
            queues = caps.queues
            agent.capabilities.queues = caps.queues
          }
        }
      } catch {}

      return { status: agent.status, cancelJobIds: result.cancelJobIds, queues }
    },

    async deregister(input: {
      agentId: string
      secret: string
    }): Promise<{ success: boolean }> {
      verifyAgent(registry, input.agentId, input.secret)
      registry.removeAgent(input.agentId)

      await db
        .query(`UPDATE worker_nodes SET status = $1 WHERE id = $2`, [
          'offline',
          input.agentId,
        ])
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
