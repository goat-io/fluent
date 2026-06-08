import type { Classification, GovernedItem } from './types.js'

/** The verdict the constitution returns for a proposed execution. */
export interface GuardVerdict {
  /** False = do not execute. */
  allow: boolean
  /** True = a human must approve before this executes (a runtime gate). */
  requiresHuman: boolean
  /** Human-readable justifications (audit trail). */
  reasons: string[]
}

/** Context handed to the guard: the resolved constraints relevant to the item. */
export interface GuardContext {
  classifications: Classification[]
}

/**
 * The Constitution as an executable gate — the org-level analogue of
 * delphi-core's per-step budget guardrail. Every governed item passes through
 * it before it can compile into a workflow run.
 */
export interface ConstitutionGuard {
  evaluate(
    item: GovernedItem,
    ctx: GuardContext,
  ): GuardVerdict | Promise<GuardVerdict>
}

export interface DefaultConstitutionGuardOptions {
  /**
   * Constraint severities that force a human review gate before execution.
   * Default: ['highest'] (e.g. life-safety).
   */
  humanReviewSeverities?: string[]
  /**
   * Constraint severities that block execution outright. Default: [] (none —
   * highest severities gate on a human rather than hard-block).
   */
  blockSeverities?: string[]
  /**
   * Optional extra predicate. Return a partial verdict to override/augment the
   * severity-based decision (e.g. parse a handlingRule). Reasons are merged.
   */
  rule?: (
    item: GovernedItem,
    ctx: GuardContext,
  ) => Partial<GuardVerdict> | undefined
}

/**
 * Severity-driven default guard. It does not try to parse free-text handling
 * rules — it keys off classification `severity`, with a pluggable predicate for
 * anything richer. Conservative by construction: an unknown highest-severity
 * constraint gates on a human rather than executing silently.
 */
export class DefaultConstitutionGuard implements ConstitutionGuard {
  private humanReviewSeverities: Set<string>
  private blockSeverities: Set<string>
  private rule?: DefaultConstitutionGuardOptions['rule']

  constructor(opts: DefaultConstitutionGuardOptions = {}) {
    this.humanReviewSeverities = new Set(
      opts.humanReviewSeverities ?? ['highest'],
    )
    this.blockSeverities = new Set(opts.blockSeverities ?? [])
    this.rule = opts.rule
  }

  evaluate(item: GovernedItem, ctx: GuardContext): GuardVerdict {
    const reasons: string[] = []
    let allow = true
    let requiresHuman = false

    for (const c of ctx.classifications) {
      if (this.blockSeverities.has(c.severity)) {
        allow = false
        reasons.push(
          `Blocked by constraint '${c.name}' (severity=${c.severity}).`,
        )
      } else if (this.humanReviewSeverities.has(c.severity)) {
        requiresHuman = true
        reasons.push(
          `Constraint '${c.name}' (severity=${c.severity}) requires human review before execution.`,
        )
      }
    }

    if (this.rule) {
      const extra = this.rule(item, ctx)
      if (extra) {
        if (extra.allow === false) {
          allow = false
        }
        if (extra.requiresHuman) {
          requiresHuman = true
        }
        if (extra.reasons) {
          reasons.push(...extra.reasons)
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push('No applicable constraints.')
    }
    return { allow, requiresHuman, reasons }
  }
}
