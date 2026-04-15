# @goatlab/delphi-ai

Multi-provider LLM adapter and multi-agent consensus layer for the Goat workflow engine. Unifies OpenAI, Anthropic, Google, and Ollama behind a single interface, with structured tool-call loops integrated into `@goatlab/delphi-core` workflows.

## What it is

A thin, opinionated layer on top of the Vercel AI SDK that:

- Provides a uniform `AIAdapter` across OpenAI, Anthropic, Google, and Ollama
- Runs tool-call loops that dispatch to workflow `skills`
- Supports multi-agent consensus (vote-or-merge across N models)
- Exposes token/cost accounting so `@goatlab/delphi-core` budgets can enforce limits

## Install

```bash
pnpm add @goatlab/delphi-ai @goatlab/delphi-core
# Plus your provider of choice:
pnpm add @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google ollama-ai-provider
```

Set provider API keys as environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or configure Ollama host).

## Quick start

```ts
import { createAIAdapter } from '@goatlab/delphi-ai'

const ai = createAIAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-6' })

const result = await ai.generate({
  system: 'You are a concise assistant.',
  messages: [{ role: 'user', content: 'Summarize the concept of eventual consistency.' }],
})
console.log(result.text, result.usage)
```

## Tool-call loop with skills

Skills are typed functions that the LLM can invoke. The adapter runs the classic call-loop until the model emits a final answer.

```ts
import { z } from 'zod'
import { createAIAdapter } from '@goatlab/delphi-ai'

const skills = {
  searchDocs: {
    description: 'Search internal docs',
    parameters: z.object({ query: z.string() }),
    handler: async ({ query }) => ({ results: await myDocsSearch(query) }),
  },
}

const ai = createAIAdapter({ provider: 'openai', model: 'gpt-4o', skills })

const out = await ai.runToolLoop({
  system: 'Answer using the searchDocs skill when you need specifics.',
  messages: [{ role: 'user', content: 'How do I enable queue-first ingestion?' }],
  maxSteps: 6,
})
```

The loop persists each tool invocation through `@goatlab/delphi-core`'s external-action machinery when wired to a running workflow — making tool calls exactly-once, replayable, and budget-aware.

## Multi-agent consensus

Run N models on the same prompt and combine outputs via voting or LLM-summarized merge:

```ts
import { consensus } from '@goatlab/delphi-ai'

const result = await consensus({
  agents: [
    { provider: 'openai',    model: 'gpt-4o'          },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'google',    model: 'gemini-2.5-pro'    },
  ],
  prompt: 'Draft three options for the email subject line.',
  strategy: 'merge', // or 'vote'
})
```

Useful when you want model-diversity robustness or cross-model agreement as a quality signal.

## Integration with `@goatlab/delphi-core`

Register as a step executor so workflow steps can call LLMs directly with full state persistence, retries, and budget enforcement:

```ts
import { AIStepExecutor } from '@goatlab/delphi-ai'

engine.registerExecutor('ai', new AIStepExecutor({ defaultProvider: 'anthropic' }))

// In a workflow:
WorkflowBuilder.create('summarize')
  .step('summarize', {
    executorType: 'ai',
    executorConfig: {
      model: 'claude-sonnet-4-6',
      prompt: 'Summarize: {{input.text}}',
    },
    stepWeight: 'ai',   // routes to workflow_step_ai queue
  })
  .build()
```

Token and cost usage are reported back via `StepResult.usage` and deducted from the run's `budgetUsed.tokens` / `costUsd`.

## Testing

```bash
pnpm test   # 63 tests, no containers needed — providers are mocked at the SDK boundary
```

## Key exports

| Export | Purpose |
|---|---|
| `createAIAdapter(config)` | Construct a provider-agnostic adapter |
| `AIStepExecutor` | Plug into `@goatlab/delphi-core` as `executorType: 'ai'` |
| `consensus({ agents, prompt, strategy })` | Multi-model consensus |
| `defineSkill(schema, handler)` | Typed tool definition |

## License

MIT
