// npx vitest run src/__tests__/executors/ai-tool-loop.spec.ts
import type {
  StepExecutor,
  StepPayload,
  StepResult,
} from '@goatlab/delphi-core'
import { SkillRegistry } from '@goatlab/delphi-core'
import { LLMAdapter } from '../llm/LLMAdapter.js'
import type {
  ChatMessage,
  ChatResponse,
  ModelConfig,
  ToolDefinition,
} from '../llm/LLMAdapter.types.js'
import { modelSelector } from '../llm/ModelSelector.js'
import { CircuitBreaker } from '../utils/CircuitBreaker.js'
import { isRetryableError, retryWithBackoff } from '../utils/RetryableClient.js'

export interface AIStepExecutorConfig {
  /** Default API keys per provider */
  apiKeys?: Record<string, string>
  /** Retry config for LLM calls */
  maxRetries?: number
  /** Circuit breaker config per provider */
  circuitBreakerFailureThreshold?: number
  circuitBreakerResetTimeoutMs?: number
  /** Optional skill registry for tool-calling loop */
  skills?: SkillRegistry
}

export class AIStepExecutor implements StepExecutor {
  readonly type = 'ai'
  private adapter: LLMAdapter
  private config: AIStepExecutorConfig
  private breakers = new Map<string, CircuitBreaker>()

  constructor(config: AIStepExecutorConfig = {}) {
    this.adapter = new LLMAdapter()
    this.config = config
  }

  async execute(payload: StepPayload): Promise<StepResult> {
    const {
      model: modelNameOrConfig,
      systemPrompt,
      outputSchema,
      ...extraConfig
    } = payload.executorConfig as {
      model: string | ModelConfig
      systemPrompt?: string
      outputSchema?: any
      maxToolTurns?: number
      maxTokenBudget?: number
      [key: string]: unknown
    }

    if (!modelNameOrConfig) {
      throw new Error(
        `AIStepExecutor: executorConfig.model is required for step "${payload.stepName}"`,
      )
    }

    const resolvedModel =
      typeof modelNameOrConfig === 'string'
        ? modelSelector.resolveModelConfig(modelNameOrConfig)
        : modelNameOrConfig

    const breaker = this.getBreaker(resolvedModel.provider)
    const skills = this.config.skills

    // Build tool definitions from skills registry
    const toolDefs: ToolDefinition[] = skills
      ? skills.toToolDefinitions().map(td => ({
          name: td.function.name,
          description: td.function.description,
          parameters: (td.function.parameters ?? {}) as Record<string, unknown>,
        }))
      : []

    // Build initial messages
    const messages: ChatMessage[] = [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : []),
      { role: 'user' as const, content: JSON.stringify(payload.input) },
    ]

    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    const maxTurns = (extraConfig.maxToolTurns as number) ?? 10
    let turns = 0
    let lastResponse: ChatResponse | null = null

    while (turns < maxTurns) {
      turns++

      const response = await breaker.execute(() =>
        retryWithBackoff(
          () =>
            this.adapter.chat({
              provider: resolvedModel.provider,
              model: resolvedModel.model,
              messages: [...messages],
              temperature: resolvedModel.temperature,
              maxTokens: resolvedModel.maxTokens,
              tools: toolDefs.length > 0 ? toolDefs : undefined,
              apiKey: resolvedModel.apiKey,
              baseUrl: resolvedModel.baseUrl,
            }),
          {
            maxAttempts: this.config.maxRetries ?? 3,
            initialDelayMs: 1000,
            shouldRetry: isRetryableError,
          },
        ),
      )

      // Accumulate usage
      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens
        totalUsage.completionTokens += response.usage.completionTokens
        totalUsage.totalTokens += response.usage.totalTokens
      }

      lastResponse = response

      // Budget enforcement — stop if token budget exceeded
      const maxBudget = extraConfig.maxTokenBudget as number | undefined
      if (maxBudget && totalUsage.totalTokens > maxBudget) {
        return {
          output: {
            response: response.content ?? 'Budget exceeded before completion',
            model: resolvedModel.model,
            usage: totalUsage,
            _usage: {
              tokens: totalUsage.totalTokens,
              model: resolvedModel.model,
              promptTokens: totalUsage.promptTokens,
              completionTokens: totalUsage.completionTokens,
            },
            turns,
            budgetExceeded: true,
            budgetLimit: maxBudget,
          } as any,
        }
      }

      // No tool calls → done
      if (!response.toolCalls?.length || !skills) {
        break
      }

      // Execute tool calls and append results to messages
      messages.push({ role: 'assistant', content: response.content || '' })

      for (const tc of response.toolCalls) {
        const skill = skills.get(tc.name)
        const result = await skill.execute((tc.arguments ?? {}) as any)
        messages.push({
          role: 'user',
          content: `Tool ${tc.name} result: ${JSON.stringify(result)}`,
        })
      }
    }

    const response = lastResponse!

    const output: Record<string, unknown> = {
      response: response.content,
      model: response.model,
      usage: totalUsage,
      _usage: {
        tokens: totalUsage.totalTokens,
        model: resolvedModel.model,
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.completionTokens,
      },
      turns,
    }

    // Parse structured output if schema provided
    if (outputSchema && response.content) {
      try {
        const parsed = JSON.parse(response.content)
        output.parsed = parsed
      } catch {
        output.parseError = 'Failed to parse structured output as JSON'
      }
    }

    return { output: output as any }
  }

  private getBreaker(provider: string): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      this.breakers.set(
        provider,
        new CircuitBreaker({
          failureThreshold: this.config.circuitBreakerFailureThreshold ?? 5,
          resetTimeoutMs: this.config.circuitBreakerResetTimeoutMs ?? 60_000,
          shouldTrip: isRetryableError,
        }),
      )
    }
    return this.breakers.get(provider)!
  }

  /** Get metrics for all provider circuit breakers */
  getProviderMetrics(): Record<string, { state: string; failures: number }> {
    const metrics: Record<string, { state: string; failures: number }> = {}
    for (const [provider, breaker] of this.breakers) {
      const m = breaker.getMetrics()
      metrics[provider] = { state: m.state, failures: m.failedCalls }
    }
    return metrics
  }
}
