export type TrackerOutcome =
  | { ok: true }
  | { ok: false; error: unknown; order: number }

export interface CreationReceipt {
  outcome: Promise<TrackerOutcome>
  settle: (outcome: TrackerOutcome) => void
  settled: boolean
}
