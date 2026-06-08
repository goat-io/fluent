// npx vitest run src/__tests__/claude-code-chat.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { createClaudeCodeChat } from '../ClaudeCodeChat.js'
import { createLLMPerspectiveEvaluator } from '../PerspectiveEvaluators.js'
import type { Decision } from '../types.js'

describe('createClaudeCodeChat', () => {
  it('builds claude -p args (system → --system-prompt) and returns .result', async () => {
    const run = vi.fn((_bin: string, _args: string[], _timeoutMs: number) =>
      JSON.stringify({ result: 'hello from claude', usage: {} }),
    )
    const chat = createClaudeCodeChat({ model: 'sonnet', run })

    const res = await chat([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'say hi' },
    ])

    expect(res.content).toBe('hello from claude')
    const call = run.mock.calls[0]
    if (!call) {
      throw new Error('claude runner was not called')
    }
    const [bin, args] = call
    expect(bin).toBe('claude')
    expect(args).toContain('-p')
    expect(args).toContain('--output-format')
    expect(args).toContain('json')
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet')
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('be terse')
    // user turn flattened into the prompt
    expect(args[args.indexOf('-p') + 1]).toContain('say hi')
  })

  it('falls back to raw stdout when the CLI output is not JSON', async () => {
    const chat = createClaudeCodeChat({ run: () => 'plain text answer' })
    const res = await chat([{ role: 'user', content: 'x' }])
    expect(res.content).toBe('plain text answer')
  })

  it('drives a real perspective review end-to-end (claude returns a verdict)', async () => {
    // Simulate claude -p returning the JSON verdict the evaluator asks for.
    const run = () =>
      JSON.stringify({
        result: '{"assessment":"approve","confidence":0.9,"concerns":[]}',
      })
    const evaluator = createLLMPerspectiveEvaluator(
      createClaudeCodeChat({ run }),
    )
    const decision: Decision = {
      name: 'd',
      kind: 'decision',
      description: 'ship it',
      status: 'proposed',
    }
    const verdict = await evaluator({
      decision,
      perspective: { name: 'security' },
    })
    expect(verdict.assessment).toBe('approve')
    expect(verdict.confidence).toBe(0.9)
  })
})
