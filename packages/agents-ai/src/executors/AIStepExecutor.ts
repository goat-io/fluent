// npx vitest run src/__tests__/executors/ai-step-executor.spec.ts
import type { StepPayload, StepResult } from '@goatlab/agents-core'
import type { StepExecutor } from '@goatlab/agents-core'
import { CircuitBreaker } from '../utils/CircuitBreaker.js'
import { isRetryableError, retryWithBackoff } from '../utils/RetryableClient.js'
import { LLMAdapter } from '../llm/LLMAdapter.js'
import type { ModelConfig } from '../llm/LLMAdapter.types.js'
import { MODEL_PRESETS } from '../llm/ModelConfig.js'
import { modelSelector } from '../llm/ModelSelector.js'

export interface AIStepExecutorConfig {
  /** Default API keys per provider */
  apiKeys?: Record<string, string>
  /** Retry config for LLM calls */
  maxRetries?: number
  /** Circuit breaker config per provider */
  circuitBreakerFailureThreshold?: number
  circuitBreakerResetTimeoutMs?: number
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
      [key: string]: unknown
    }

    if (!modelNameOrConfig) {
      throw new Error(
        `AIStepExecutor: executorConfig.model is required for step "${payload.stepName}"`,
      )
    }

    const resolvedModel = typeof modelNameOrConfig === 'string'
      ? modelSelector.resolveModelConfig(modelNameOrConfig)
      : modelNameOrConfig

    const breaker = this.getBreaker(resolvedModel.provider)

    const response = await breaker.execute(() =>
      retryWithBackoff(
        () =>
          this.adapter.chatFromConfig(resolvedModel, [
            ...(systemPrompt
              ? [{ role: 'system' as const, content: systemPrompt }]
              : []),
            { role: 'user' as const, content: JSON.stringify(payload.input) },
          ]),
        {
          maxAttempts: this.config.maxRetries ?? 3,
          initialDelayMs: 1000,
          shouldRetry: isRetryableError,
        },
      ),
    )

    const output: Record<string, unknown> = {
      response: response.content,
      model: response.model,
      usage: response.usage,
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
          failureThreshold:
            this.config.circuitBreakerFailureThreshold ?? 5,
          resetTimeoutMs:
            this.config.circuitBreakerResetTimeoutMs ?? 60_000,
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
