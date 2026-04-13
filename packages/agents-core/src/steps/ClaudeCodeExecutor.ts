// npx vitest run src/__tests__/engine/claude-code.spec.ts
//
// ClaudeCodeExecutor — runs prompts via `claude -p` CLI (Claude Code).
// Uses your Claude Max subscription. No API key needed.
// The worker machine must have Claude Code installed and authenticated.
//
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process'
import type { StepExecutor } from './StepExecutor.js'
import type { StepExecutionContext, StepPayload, StepResult } from '../workflow/WorkflowBuilder.types.js'

export interface ClaudeCodeConfig {
  /** The prompt to send to Claude. Supports template variables: {{input.fieldName}} */
  prompt?: string
  /** System prompt appended via --append-system-prompt */
  systemPrompt?: string
  /** Output format: 'text' (default) or 'json' */
  outputFormat?: 'text' | 'json'
  /** Max turns for agentic tasks (default: 1 for simple prompts) */
  maxTurns?: number
  /** Model override (e.g., 'claude-sonnet-4-20250514') */
  model?: string
  /** Timeout in ms (default: 300_000 = 5 min) */
  timeoutMs?: number
  /** Allow file/tool access in non-interactive mode */
  allowedTools?: string[]
}

export class ClaudeCodeExecutor implements StepExecutor {
  readonly type = 'claude_code'

  async execute(payload: StepPayload, _context?: StepExecutionContext): Promise<StepResult> {
    const config = payload.executorConfig as unknown as ClaudeCodeConfig
    const input = payload.input as Record<string, unknown>

    // Build the prompt — resolve template variables from input
    let prompt = config.prompt ?? ''
    if (!prompt && typeof input.prompt === 'string') {
      prompt = input.prompt
    }

    // Replace {{input.fieldName}} with actual values
    prompt = prompt.replace(/\{\{input\.(\w+)\}\}/g, (_match, field) => {
      const value = input[field]
      return value !== undefined ? String(value) : ''
    })

    // If input has data, append it as context
    if (!prompt && Object.keys(input).length > 0) {
      prompt = JSON.stringify(input, null, 2)
    }

    if (!prompt.trim()) {
      throw new Error('ClaudeCodeExecutor: no prompt provided (set executorConfig.prompt or pass input.prompt)')
    }

    // Build CLI args
    const args: string[] = ['-p', prompt]

    if (config.systemPrompt) {
      args.push('--append-system-prompt', config.systemPrompt)
    }

    if (config.outputFormat === 'json') {
      args.push('--output-format', 'json')
    }

    if (config.maxTurns) {
      args.push('--max-turns', String(config.maxTurns))
    }

    if (config.model) {
      args.push('--model', config.model)
    }

    if (config.allowedTools?.length) {
      for (const tool of config.allowedTools) {
        args.push('--allowedTools', tool)
      }
    }

    // Execute claude CLI
    const timeoutMs = config.timeoutMs ?? 300_000
    const execOpts: ExecSyncOptionsWithStringEncoding = {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
      stdio: ['pipe', 'pipe', 'pipe'],
    }

    try {
      const cmd = `claude ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
      const stdout = execSync(cmd, execOpts)

      // Parse output
      let output: Record<string, any>
      if (config.outputFormat === 'json') {
        try {
          const parsed = JSON.parse(stdout)
          output = { result: parsed, _raw: undefined }
          // Extract usage if available in JSON output
          if (parsed.usage) {
            output._usage = {
              tokens: (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0),
              model: parsed.model ?? config.model ?? 'claude',
            }
          }
        } catch {
          output = { result: stdout.trim() }
        }
      } else {
        output = { result: stdout.trim() }
      }

      return { output }
    } catch (err: any) {
      // Check if it's a timeout
      if (err.killed || err.signal === 'SIGTERM') {
        throw new Error(`Claude Code timed out after ${timeoutMs}ms`)
      }

      // Include stderr in error message
      const stderr = err.stderr?.toString?.()?.trim?.() ?? ''
      const message = stderr || err.message || 'Claude Code execution failed'
      throw new Error(message)
    }
  }
}
