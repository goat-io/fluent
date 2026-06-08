// npx vitest run src/__tests__/perspective-evaluators.spec.ts
import { describe, expect, it, vi } from 'vitest'
import {
  type ChatLike,
  createLLMPerspectiveEvaluator,
  heuristicPerspectiveEvaluator,
} from '../PerspectiveEvaluators.js'
import { PerspectiveReviewer } from '../PerspectiveReviewer.js'
import type { Decision } from '../types.js'

const deleteProdDecision: Decision = {
  name: 'delete-idle-prod-db',
  kind: 'decision',
  description: 'Delete an idle production database cluster to cut cost.',
  status: 'proposed',
  choice: 'Snapshot then delete the production Aurora cluster.',
}

describe('heuristicPerspectiveEvaluator', () => {
  it('rejects from security when the decision touches production', async () => {
    const reviewer = new PerspectiveReviewer({
      evaluator: heuristicPerspectiveEvaluator(),
    })
    const matrix = await reviewer.review(deleteProdDecision, [
      { name: 'security' },
      { name: 'finance' },
    ])
    const sec = matrix.verdicts.find(v => v.perspective === 'security')
    const fin = matrix.verdicts.find(v => v.perspective === 'finance')
    expect(sec?.assessment).toBe('reject')
    expect(fin?.assessment).toBe('approve') // no finance signal in the text
  })

  it('is deterministic and approves benign decisions', async () => {
    const benign: Decision = {
      name: 'add-readme',
      kind: 'decision',
      description: 'Add a README to a package.',
      status: 'proposed',
    }
    const evaluator = heuristicPerspectiveEvaluator()
    const a = await evaluator({
      decision: benign,
      perspective: { name: 'security' },
    })
    const b = await evaluator({
      decision: benign,
      perspective: { name: 'security' },
    })
    expect(a).toEqual(b)
    expect(a.assessment).toBe('approve')
  })
})

describe('createLLMPerspectiveEvaluator', () => {
  it('parses a JSON verdict from the chat response (tolerating code fences)', async () => {
    const chat: ChatLike = vi.fn(async () => ({
      content:
        '```json\n{"assessment":"concerns","confidence":0.6,"concerns":["margin risk"],"rationale":"thin margins"}\n```',
    }))
    const evaluator = createLLMPerspectiveEvaluator(chat)
    const verdict = await evaluator({
      decision: deleteProdDecision,
      perspective: { name: 'finance', criteria: ['unit economics'] },
    })
    expect(verdict).toMatchObject({
      perspective: 'finance',
      assessment: 'concerns',
      confidence: 0.6,
      concerns: ['margin risk'],
    })
  })

  it('degrades to not_applicable when output is not parseable', async () => {
    const chat: ChatLike = async () => ({
      content: 'I think it is fine, no JSON here.',
    })
    const evaluator = createLLMPerspectiveEvaluator(chat)
    const verdict = await evaluator({
      decision: deleteProdDecision,
      perspective: { name: 'finance' },
    })
    expect(verdict.assessment).toBe('not_applicable')
    expect(verdict.confidence).toBe(0)
  })

  it('clamps out-of-range confidence and coerces an unknown assessment', async () => {
    const chat: ChatLike = async () => ({
      content: '{"assessment":"definitely","confidence":5,"concerns":[]}',
    })
    const verdict = await createLLMPerspectiveEvaluator(chat)({
      decision: deleteProdDecision,
      perspective: { name: 'legal' },
    })
    expect(verdict.assessment).toBe('not_applicable') // unknown → safe default
    expect(verdict.confidence).toBe(1) // clamped
  })
})
