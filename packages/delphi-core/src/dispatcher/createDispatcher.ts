// createDispatcher.ts — Factory for the cross-tenant dispatch singleton.
//
// Creates a Dispatcher that coordinates dispatch hints across N tenant engines.
// Supports two hint transports:
//   - Redis (BullMQ): uses createHintRegistry from @goatlab/tasks-core
//   - Postgres: uses PgHintTransport (LISTEN/NOTIFY + polling)
//
// The hint transport is independent of each tenant's dispatch backend —
// tenants can use BullMQ or PgConnector regardless of hint transport.

import { createDispatchHandler } from './DispatchHandler.js'
import type { Dispatcher, DispatcherConfig } from './dispatcher.types.js'
import { PgHintTransport } from './PgHintTransport.js'
import { ScheduleSyncer } from './ScheduleSyncer.js'

export function createDispatcher(config: DispatcherConfig): Dispatcher {
  const hasRedis = config.redis != null
  const hasPg = config.database != null

  if (!hasRedis && !hasPg) {
    throw new Error(
      'createDispatcher: provide either `redis` or `database` for hint transport.',
    )
  }
  if (hasRedis && hasPg) {
    throw new Error(
      'createDispatcher: provide either `redis` or `database`, not both.',
    )
  }

  // ── Hint transport layer ──────────────────────────────────────────

  let hintTransport: {
    fireHint: (params: {
      tenantId: string
      queueName: string
      jobId: string
    }) => Promise<void>
    start: () => Promise<void>
    stop: () => Promise<void>
    isRunning: () => boolean
  }

  if (hasRedis) {
    // Redis mode — use BullMQ dispatch-hints queue via tasks-core
    let BullMQConnector: any
    let createHintRegistry: any
    try {
      BullMQConnector = require('@goatlab/tasks-adapter-bullmq').BullMQConnector
      createHintRegistry = require('@goatlab/tasks-core').createHintRegistry
    } catch {
      throw new Error(
        'createDispatcher (Redis mode): @goatlab/tasks-adapter-bullmq is required. ' +
          'Install with: pnpm add @goatlab/tasks-adapter-bullmq',
      )
    }

    const prefix = config.dispatchPrefix ?? 'dispatch'
    const dispatchConnector = new BullMQConnector({
      connection: config.redis,
      prefix,
      defaultJobOptions: config.hintJobOptions ?? {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    })

    const registry = createHintRegistry(dispatchConnector)
    let listenHandle: {
      stop: () => Promise<void>
      isRunning: () => boolean
    } | null = null

    hintTransport = {
      async fireHint(params) {
        await registry.queue({
          dispatchHints: {
            tenantId: params.tenantId,
            queueName: params.queueName,
            jobId: params.jobId.replaceAll(':', '_'),
            dispatchUrl: config.dispatchUrl,
          },
        })
      },
      async start() {
        if (listenHandle) {
          return
        }
        listenHandle = await registry.listen({ dispatchHints: true })
        config.logger?.info('[Dispatcher] Redis hint listener started')
      },
      async stop() {
        if (listenHandle) {
          await listenHandle.stop()
          listenHandle = null
        }
        try {
          await dispatchConnector.close?.()
        } catch {
          /* ignore */
        }
        config.logger?.info('[Dispatcher] Redis hint listener stopped')
      },
      isRunning() {
        return listenHandle?.isRunning() ?? false
      },
    }
  } else {
    // Postgres mode — use PgHintTransport
    const pgTransport = new PgHintTransport({
      db: config.database!,
      onHint: async hint => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 60_000)
        try {
          const response = await globalThis.fetch(hint.dispatchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': hint.tenantId,
              'X-Dispatch-Source': 'pg-transport',
            },
            body: JSON.stringify(hint),
            signal: controller.signal,
          })
          if (!response.ok) {
            const text = await response.text().catch(() => 'Unknown error')
            throw new Error(`Dispatch returned ${response.status}: ${text}`)
          }
        } finally {
          clearTimeout(timeout)
        }
      },
      dispatchUrl: config.dispatchUrl,
      logger: config.logger,
    })

    hintTransport = {
      fireHint: params => pgTransport.fireHint(params),
      start: () => pgTransport.start(),
      stop: () => pgTransport.stop(),
      isRunning: () => pgTransport.isRunning(),
    }
  }

  // ── Dispatch handler ──────────────────────────────────────────────

  const handler = createDispatchHandler({
    resolveTenant: config.resolveTenant,
    validQueueNames: config.validQueueNames,
    timeBudgetMs: config.timeBudgetMs,
    wrapExecution: config.wrapExecution,
    logger: config.logger,
  })

  // ── Schedule syncer ───────────────────────────────────────────────

  const scheduleSyncer = new ScheduleSyncer({
    listTenants: config.listTenants,
    resolveTenant: config.resolveTenant,
    logger: config.logger,
  })

  // ── Assemble dispatcher ───────────────────────────────────────────

  const dispatcher: Dispatcher = {
    async start() {
      await hintTransport.start()
    },

    async stop() {
      await hintTransport.stop()
    },

    isRunning() {
      return hintTransport.isRunning()
    },

    handler,

    async fireHint(params) {
      try {
        await hintTransport.fireHint(params)
      } catch (err) {
        config.logger?.error(
          `[Dispatcher] Failed to fire hint for ${params.queueName}:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    },

    async syncSchedules(environment?: string) {
      const result = await scheduleSyncer.sync(environment)
      config.logger?.info(
        `[Dispatcher] Synced ${result.totalJobs} schedules across ${result.tenantCount} tenants`,
      )
      return result
    },
  }

  return dispatcher
}
