import { execFileSync } from 'node:child_process'
import type { ChatLike } from './PerspectiveEvaluators.js'

// A ChatLike backed by the local Claude Code CLI (`claude -p`). Uses your Claude
// subscription via the installed/authenticated CLI — NO API key required. Pair
// it with createLLMPerspectiveEvaluator for real perspective review offline of
// any provider SDK.

export interface ClaudeCodeChatOptions {
  /** Model alias or id: 'sonnet' (default) | 'opus' | 'haiku' | full id. */
  model?: string
  /** Per-call timeout. Default 120s. */
  timeoutMs?: number
  /** Binary name/path. Default 'claude'. */
  claudeBin?: string
  /** Cap agentic turns. Default 1 (single completion — right for review). */
  maxTurns?: number
  /**
   * Injectable command runner (tests). Receives (bin, args, timeoutMs) and
   * returns stdout. Defaults to a synchronous execFileSync.
   */
  run?: (bin: string, args: string[], timeoutMs: number) => string
}

/** True if the `claude` CLI is callable (cheap `--version` probe). */
export function claudeCodeAvailable(claudeBin = 'claude'): boolean {
  try {
    execFileSync(claudeBin, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Build a ChatLike that runs prompts through `claude -p --output-format json`.
 * System messages become `--system-prompt`; the remaining turns are flattened
 * into the prompt. Returns the model's text (the CLI's `.result` field).
 */
export function createClaudeCodeChat(
  opts: ClaudeCodeChatOptions = {},
): ChatLike {
  const model = opts.model ?? 'sonnet'
  const timeoutMs = opts.timeoutMs ?? 120_000
  const bin = opts.claudeBin ?? 'claude'
  const maxTurns = opts.maxTurns ?? 1
  const run =
    opts.run ??
    ((b, args, t) =>
      execFileSync(b, args, {
        encoding: 'utf8',
        timeout: t,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      }))

  return async messages => {
    const system = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n')
    const prompt = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--model',
      model,
      '--max-turns',
      String(maxTurns),
    ]
    if (system) {
      args.push('--system-prompt', system)
    }

    const stdout = run(bin, args, timeoutMs)
    try {
      const parsed = JSON.parse(stdout) as { result?: unknown }
      if (typeof parsed.result === 'string') {
        return { content: parsed.result }
      }
      if (typeof parsed === 'string') {
        return { content: parsed }
      }
      return { content: stdout.trim() }
    } catch {
      return { content: stdout.trim() }
    }
  }
}
