import type { Worker } from 'bullmq'

export type ListenerOutcome = { ok: true } | { ok: false; error: unknown }

export interface ListenerWorker {
  key: string
  worker: Worker
  run: Promise<ListenerOutcome>
}
