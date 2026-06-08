import type {
  Perspective,
  PerspectiveEvaluator,
  PerspectiveVerdict,
  ReviewAssessment,
} from './Perspective.js'
import type { Decision } from './types.js'

// Concrete PerspectiveEvaluator implementations. Two flavours:
//   - createLLMPerspectiveEvaluator: structural over any chat() fn (back it with
//     @goatlab/delphi-ai's LLMAdapter) — real reasoning.
//   - heuristicPerspectiveEvaluator: deterministic, offline — keyword signals.
//     Lets the review loop run with no API keys / no Ollama.

/** Minimal structural chat contract (matches delphi-ai's LLMAdapter.chat shape). */
export type ChatLike = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) => Promise<{ content: string }>

function decisionSummary(d: Decision): string {
  return [
    `Name: ${d.name}`,
    `Description: ${d.description}`,
    d.context ? `Context: ${d.context}` : '',
    d.choice ? `Proposed choice: ${d.choice}` : '',
    d.consequences ? `Consequences: ${d.consequences}` : '',
    d.tags?.length ? `Tags: ${d.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const VALID_ASSESSMENTS: ReadonlySet<string> = new Set([
  'approve',
  'concerns',
  'reject',
  'not_applicable',
])

function parseVerdict(
  raw: string,
  perspectiveName: string,
): PerspectiveVerdict {
  // Tolerate code fences and surrounding prose — extract the first JSON object.
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as Partial<PerspectiveVerdict>
      const assessment = VALID_ASSESSMENTS.has(obj.assessment as string)
        ? (obj.assessment as ReviewAssessment)
        : 'not_applicable'
      return {
        perspective: perspectiveName,
        assessment,
        confidence:
          typeof obj.confidence === 'number'
            ? Math.max(0, Math.min(1, obj.confidence))
            : 0.5,
        concerns: Array.isArray(obj.concerns) ? obj.concerns.map(String) : [],
        rationale:
          typeof obj.rationale === 'string' ? obj.rationale : undefined,
      }
    } catch {
      // fall through
    }
  }
  return {
    perspective: perspectiveName,
    assessment: 'not_applicable',
    confidence: 0,
    concerns: ['Could not parse a structured verdict from the model.'],
    rationale: raw.slice(0, 280),
  }
}

export interface LLMPerspectiveEvaluatorOptions {
  /** Optional extra instruction appended to every review prompt. */
  systemPreamble?: string
}

/**
 * Build a PerspectiveEvaluator backed by an LLM `chat` function. Each review
 * asks the model to reason as the given perspective and return a strict JSON
 * verdict. Parsing is tolerant; unparseable output degrades to not_applicable
 * rather than throwing.
 *
 *   import { LLMAdapter } from '@goatlab/delphi-ai'
 *   const adapter = new LLMAdapter()
 *   const chat: ChatLike = (messages) =>
 *     adapter.chat({ provider: 'anthropic', model: 'claude-sonnet-4-6', messages })
 *   const evaluator = createLLMPerspectiveEvaluator(chat)
 */
export function createLLMPerspectiveEvaluator(
  chat: ChatLike,
  opts: LLMPerspectiveEvaluatorOptions = {},
): PerspectiveEvaluator {
  return async ({ decision, perspective, context }) => {
    const system = [
      `You are reviewing a proposed organizational decision strictly from the ${perspective.name.toUpperCase()} perspective.`,
      perspective.criteria?.length
        ? `Your evaluation criteria: ${perspective.criteria.join('; ')}.`
        : '',
      'Surface tradeoffs honestly — the goal is visibility, not consensus.',
      opts.systemPreamble ?? '',
      'Respond with ONLY a JSON object: {"assessment": "approve"|"concerns"|"reject"|"not_applicable", "confidence": 0..1, "concerns": string[], "rationale": string}.',
    ]
      .filter(Boolean)
      .join('\n')

    const user = [
      decisionSummary(decision),
      context ? `\nRetrieved context:\n${context}` : '',
    ].join('\n')

    const { content } = await chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    return parseVerdict(content, perspective.name)
  }
}

export interface HeuristicSignal {
  /** Lowercased substrings that trigger this signal. */
  keywords: string[]
  /** Assessment to emit when a keyword matches. */
  assessment: ReviewAssessment
  /** Concern text to attach. */
  concern: string
}

export interface HeuristicEvaluatorOptions {
  /**
   * Per-perspective signal rules. When a decision's text matches a signal's
   * keyword, that perspective emits the signal's assessment. With no match a
   * perspective approves. Sensible defaults cover finance/security/customer/legal.
   */
  signals?: Record<string, HeuristicSignal[]>
  /** Assessment when no signal matches. Default 'approve'. */
  defaultAssessment?: ReviewAssessment
}

const DEFAULT_SIGNALS: Record<string, HeuristicSignal[]> = {
  finance: [
    {
      keywords: ['spend', 'budget', 'expensive', 'cost increase'],
      assessment: 'concerns',
      concern: 'Potential cost/budget impact.',
    },
  ],
  security: [
    {
      keywords: [
        'delete',
        'drop',
        'production',
        'secret',
        'credential',
        'disable',
      ],
      assessment: 'reject',
      concern: 'Touches production / sensitive resources — needs review.',
    },
  ],
  customer: [
    {
      keywords: ['pricing', 'price increase', 'remove feature', 'deprecate'],
      assessment: 'concerns',
      concern: 'May affect customer trust / retention.',
    },
  ],
  legal: [
    {
      keywords: ['data', 'pii', 'gdpr', 'retention', 'share'],
      assessment: 'concerns',
      concern: 'Possible regulatory/compliance implication.',
    },
  ],
}

/**
 * Deterministic, offline PerspectiveEvaluator. Each perspective approves unless
 * the decision text matches one of its signal keywords. Good enough to exercise
 * the full review→decide loop with no model — and reproducible in tests.
 */
export function heuristicPerspectiveEvaluator(
  opts: HeuristicEvaluatorOptions = {},
): PerspectiveEvaluator {
  const signals = opts.signals ?? DEFAULT_SIGNALS
  const fallback = opts.defaultAssessment ?? 'approve'

  return ({ decision, perspective }) => {
    const haystack = decisionSummary(decision).toLowerCase()
    const rules = signals[perspective.name] ?? []
    for (const rule of rules) {
      if (rule.keywords.some(k => haystack.includes(k.toLowerCase()))) {
        return {
          perspective: perspective.name,
          assessment: rule.assessment,
          confidence: 0.8,
          concerns: [rule.concern],
        } satisfies PerspectiveVerdict
      }
    }
    return {
      perspective: perspective.name,
      assessment: fallback,
      confidence: 0.7,
      concerns: [],
    } satisfies PerspectiveVerdict
  }
}

/** Convenience: a Perspective list covering the common organizational lenses. */
export const STANDARD_PERSPECTIVES: Perspective[] = [
  { name: 'finance', weight: 1 },
  { name: 'security', weight: 2 },
  { name: 'customer', weight: 1 },
  { name: 'operations', weight: 1 },
  { name: 'legal', weight: 1 },
]
