import type { Job, Worker } from 'bullmq'

export type ListenerOutcome = { ok: true } | { ok: false; error: unknown }

export interface ListenerWorker {
  key: string
  worker: Worker
  run: Promise<ListenerOutcome>
}

export interface DispatchJob {
  job: Job
  chain: Promise<void>
  timer?: ReturnType<typeof setTimeout>
  acknowledging: boolean
  terminal: boolean
  uncertain: boolean
  provisional?: { error: unknown; order: number }
}

export interface DispatchParameters {
  handleTask: (queueName: string, data: unknown) => Promise<unknown>
  timeBudgetMs?: number
  validQueueNames?: Set<string>
  batchSize?: number
  concurrency?: number
  hint?: {
    tenantId?: string
    queueName?: string
    jobId?: string
    data?: unknown
  }
}

export interface DispatchResult {
  processed: number
  failed: number
}

export type DispatchOutcome =
  | { ok: true }
  | { ok: false; error: unknown; order: number }

export interface OwnedDispatch {
  outcome: Promise<DispatchOutcome>
}
