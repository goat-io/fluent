import type { Action, Classification, Decision, Outcome } from './types.js'

/**
 * Read/write access to the judgment plane (the Delphi Brain). The Brain is the
 * git-versioned system of record; this interface is what the governance bridge
 * needs from it. Implementations: {@link InMemoryBrainClient} (tests) and
 * {@link HttpBrainClient} (the Go Brain sidecar's REST API).
 */
export interface BrainClient {
  /** Actions ready to execute (readiness policy lives in the implementation). */
  listExecutableActions(): Promise<Action[]>
  /** Resolve a decision by name (or null). */
  getDecision(name: string): Promise<Decision | null>
  /** Resolve a classification/constraint by name (or null). */
  getClassification(name: string): Promise<Classification | null>
  /** Persist an outcome back to the Brain. Optional — not all backends write. */
  recordOutcome?(outcome: Outcome): Promise<void>
}

/** In-memory BrainClient for tests and local wiring. */
export class InMemoryBrainClient implements BrainClient {
  actions: Action[] = []
  decisions = new Map<string, Decision>()
  classifications = new Map<string, Classification>()
  outcomes: Outcome[] = []

  constructor(seed?: {
    actions?: Action[]
    decisions?: Decision[]
    classifications?: Classification[]
  }) {
    if (seed?.actions) {
      this.actions = seed.actions
    }
    for (const d of seed?.decisions ?? []) {
      this.decisions.set(d.name, d)
    }
    for (const c of seed?.classifications ?? []) {
      this.classifications.set(c.name, c)
    }
  }

  async listExecutableActions(): Promise<Action[]> {
    // Default readiness policy: proposed actions that are not blocked.
    return this.actions.filter(
      a => a.status === 'proposed' && !a.blockedBy?.length,
    )
  }

  async getDecision(name: string): Promise<Decision | null> {
    return this.decisions.get(name) ?? null
  }

  async getClassification(name: string): Promise<Classification | null> {
    return this.classifications.get(name) ?? null
  }

  async recordOutcome(outcome: Outcome): Promise<void> {
    this.outcomes.push(outcome)
  }
}

export interface HttpBrainClientOptions {
  /** Base URL of the Brain CLI API, e.g. http://localhost:7613 */
  baseUrl: string
  /** Optional fetch override (defaults to global fetch). */
  fetch?: typeof fetch
  /**
   * Which action statuses count as "ready to execute". Default: ['proposed'].
   */
  executableStatuses?: string[]
  /** Optional sink for outcomes (the Brain REST API is read-mostly). */
  onOutcome?: (outcome: Outcome) => Promise<void> | void
}

/**
 * BrainClient backed by the Go Brain sidecar's REST API
 * (`GET /api/catalog`, `GET /api/catalog/:domain/:name`). Reads are best-effort
 * against the documented endpoints; writing outcomes back to git is delegated to
 * `onOutcome` (the Brain API does not expose a catalog-write endpoint).
 */
export class HttpBrainClient implements BrainClient {
  private baseUrl: string
  private fetchFn: typeof fetch
  private executableStatuses: Set<string>
  private onOutcome?: HttpBrainClientOptions['onOutcome']

  constructor(opts: HttpBrainClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchFn = opts.fetch ?? globalThis.fetch
    this.executableStatuses = new Set(opts.executableStatuses ?? ['proposed'])
    this.onOutcome = opts.onOutcome
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`)
    if (!res.ok) {
      throw new Error(`Brain API ${path} -> ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as T
  }

  /** Flatten the catalog list endpoint into typed entries of a given kind. */
  private async listKind<T>(kind: string): Promise<T[]> {
    const data = await this.getJson<unknown>('/api/catalog')
    const entries = Array.isArray(data)
      ? data
      : ((data as { entries?: unknown[] })?.entries ?? [])
    return (entries as Record<string, unknown>[])
      .map(e => (e.spec ?? e) as Record<string, unknown>)
      .filter(e => e.kind === kind) as T[]
  }

  async listExecutableActions(): Promise<Action[]> {
    const actions = await this.listKind<Action>('action')
    return actions.filter(a => this.executableStatuses.has(a.status))
  }

  async getDecision(name: string): Promise<Decision | null> {
    const decisions = await this.listKind<Decision>('decision')
    return decisions.find(d => d.name === name) ?? null
  }

  async getClassification(name: string): Promise<Classification | null> {
    const classifications =
      await this.listKind<Classification>('classification')
    return classifications.find(c => c.name === name) ?? null
  }

  async recordOutcome(outcome: Outcome): Promise<void> {
    await this.onOutcome?.(outcome)
  }
}
