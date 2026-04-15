# @goatlab/delphi-langgraph

LangGraph integration for `@goatlab/delphi-core`. Run LangGraph `StateGraph`s as first-class workflows — with Postgres checkpointing, step-level durability, and full integration into the Goat engine's budgets, tracing, and HITL.

## What it is

A thin adapter that:

- Executes a LangGraph `StateGraph` as a single workflow step (or a subgraph of coordinated steps)
- Persists checkpoints to Postgres via `@langchain/langgraph-checkpoint-postgres`
- Surfaces LangGraph interrupts as `waitForHuman` pauses in the Goat engine
- Reports token/cost usage back to the engine's budget system

Use this when you already have a LangGraph design (or want to leverage its rich graph abstractions — routers, conditional edges, maps) but want the Goat engine to own durability, queuing, and multi-tenant isolation.

## Install

```bash
pnpm add @goatlab/delphi-langgraph @goatlab/delphi-core \
  @langchain/langgraph @langchain/langgraph-checkpoint-postgres @langchain/core
```

Requires Postgres 14+ (shared with `@goatlab/delphi-core`).

## Quick start

```ts
import { StateGraph, Annotation } from '@langchain/langgraph'
import { createLangGraphExecutor } from '@goatlab/delphi-langgraph'

// Your LangGraph graph
const State = Annotation.Root({
  messages: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
})

const graph = new StateGraph(State)
  .addNode('research', async (s) => ({ messages: [`researched: ${s.messages[0]}`] }))
  .addNode('write',    async (s) => ({ messages: [`wrote: ${s.messages.at(-1)}`] }))
  .addEdge('__start__', 'research')
  .addEdge('research', 'write')
  .addEdge('write', '__end__')
  .compile()

// Register as a Goat executor
engine.registerExecutor('langgraph', createLangGraphExecutor({ pgPool: pool }))

// Workflow that runs the graph
WorkflowBuilder.create('research_pipeline')
  .step('run', {
    executorType: 'langgraph',
    executorConfig: { graph, threadIdFrom: 'runId' },
  })
  .build()

await engine.start({ workflowName: 'research_pipeline', tenantId: 'default', input: { topic: 'quantum networks' } })
```

## How it maps

| LangGraph | Goat engine |
|---|---|
| Graph compile | Executor config (pass graph reference) |
| Checkpoints | Postgres tables (shared pool with the engine) |
| `interrupt()` | Step transitions to `WAITING_HUMAN` |
| `Send` / conditional edges | Inside the step — engine sees a single step boundary |
| Token usage (AIMessage) | `StepResult.usage` → engine budget |
| Graph error | `StepResult.error`, triggers normal retry/backoff |

## When to use this vs. plain delphi-core steps

- **Use this** when you have complex routing / dynamic fan-out patterns, model-based state reducers, or a team already invested in LangGraph.
- **Use plain `@goatlab/delphi-core` DAGs** when steps are mostly linear or fan-out is known at definition time. Lower overhead, direct integration with queue-first ingestion.

You can mix both: a Goat workflow can have one LangGraph step plus several function/AI steps.

## Testing

```bash
pnpm test   # needs Docker for Postgres testcontainer (uses LangGraph's checkpoint adapter)
```

## Key exports

| Export | Purpose |
|---|---|
| `createLangGraphExecutor(config)` | Returns a `StepExecutor` to register with the engine |
| `LangGraphStepConfig` | Executor-config shape (graph, thread id mapping, checkpoint options) |

## License

MIT
