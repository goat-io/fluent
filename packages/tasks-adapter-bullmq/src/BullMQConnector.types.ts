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
