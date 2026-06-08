# @goatlab/delphi-governance

The **governance bridge** for the Delphi agent OS — the seam that makes the Company Brain *executable*.

It compiles approved **Decisions/Actions** from the [Brain](../delphi-brain) (the judgment plane) into [delphi-core](../delphi-core) **workflow runs** (the execution plane), gates them through a **Constitution**, and records **Outcomes** back. This is the concrete realization of the Delphi thesis that *"tasks are an implementation detail compiled from decisions."*

```
Brain (git, judgment)            delphi-governance              delphi-core (pg, execution)
  decision / action  ─────►  guard → compile → start  ─────►  workflow run (exactly-once)
        ▲                                                              │
        └──────────────  Outcome  ◄── onEngineEvent (run.completed) ◄──┘
```

## Design

- **Independent of delphi-core at compile time.** This package imports nothing from delphi-core; it binds to an engine structurally via `fromEngine()`. delphi-core is an *optional* peer.
- **Exactly-once.** `idempotencyKey = action.name` → re-running the loop never double-executes (delphi-core dedups).
- **Stateless outcome mapping.** `traceId = decision:<name>` is deterministic, so `run.completed` events map back to the originating item with no external store.
- **Constitution as a gate.** The org-level analogue of delphi-core's per-step budget guardrail: every item passes the `ConstitutionGuard` before it can run.

## Pieces

| Export | Role |
|---|---|
| `BrainClient` (`InMemoryBrainClient`, `HttpBrainClient`) | read Decisions/Actions/Classifications, record Outcomes |
| `ConstitutionGuard` (`DefaultConstitutionGuard`) | allow / block / require-human, from classification severity |
| `CompileRegistry` | `Action.type` → `{ workflowName, mapInput }` |
| `WorkflowStarter` (`fromEngine`) | structural adapter to a delphi-core `createEngine()` result |
| `DecisionExecutor` | guard → compile → start; `execute(action)` / `executePending(brain)` |
| `PerspectiveReviewer` | run N perspectives over a Decision → a tradeoff matrix (concurrent, fault-tolerant) |
| `createClaudeCodeChat` / `claudeCodeAvailable` | a `ChatLike` backed by the `claude -p` CLI — real LLM review with **no API key** (uses your Claude subscription) |
| `ReviewDecider` (`DefaultReviewDecider`) | map the matrix → `approved` / `rejected` / `needs_human` (constitution decides) |
| `createOutcomeSubscriber` | the Measure seam — an `onEngineEvent` handler |
| `createGovernance` | wires it all together (`.reviewDecision()`, `.tick()`, `.onEngineEvent`) |

## Perspectives (Propose → Review → Decide)

Perspectives replace roles. Before a Decision is approved, run it past a set of reusable reasoning lenses (Finance, Security, Customer, …). The goal is **visibility into tradeoffs, not consensus** — the `ReviewDecider` (the constitution's rules) makes the call; the perspectives inform it. A single `reject` escalates to a human rather than being silently outvoted, and the full matrix always rides along on the result.

```ts
const governance = createGovernance({
  brain, starter: fromEngine(engine),
  review: {
    // back the evaluator with @goatlab/delphi-ai (LLMAdapter / AgreementOrchestrator)
    evaluator: async ({ decision, perspective, context }) => llmReview(decision, perspective, context),
    // optional: pull Brain RAG context per perspective
    loadContext: ({ perspective }) => brainSearch(perspective.name),
  },
})

const { outcome, matrix, score } = await governance.reviewDecision(decision, [
  { name: 'finance', weight: 2 },
  { name: 'customer' },
  { name: 'security' },
])
// outcome: 'approved' | 'rejected' | 'needs_human'  — then flip the decision + let .tick() execute it
```

The `evaluator` is structural (a function), so this package stays independent of delphi-ai — wire an LLM-backed reviewer at the edge. The easiest real reviewer needs **no API key**:

```ts
import { createClaudeCodeChat, createLLMPerspectiveEvaluator, claudeCodeAvailable } from '@goatlab/delphi-governance'

const evaluator = claudeCodeAvailable()
  ? createLLMPerspectiveEvaluator(createClaudeCodeChat({ model: 'sonnet' })) // uses `claude -p`
  : heuristicPerspectiveEvaluator()                                          // offline fallback
```

## Usage

```ts
import { createEngine } from '@goatlab/delphi-core'
import {
  createGovernance, CompileRegistry, HttpBrainClient, fromEngine,
  DefaultConstitutionGuard,
} from '@goatlab/delphi-governance'

const brain = new HttpBrainClient({ baseUrl: 'http://localhost:7613' }) // Brain sidecar

const registry = new CompileRegistry()
  .register('cost-cut', { workflowName: 'awsCostCut', mapInput: a => ({ cluster: a.target }) })

// Build governance first so we can hand the engine its Measure hook.
let governance
const engine = createEngine({
  workflows: [AwsCostCutWorkflow],
  onEngineEvent: evt => governance.onEngineEvent(evt),  // record outcomes back
})
governance = createGovernance({
  brain,
  starter: fromEngine(engine),
  registry,
  guard: new DefaultConstitutionGuard({ humanReviewSeverities: ['highest'] }),
})

// One loop tick: compile every approved/ready action into an exactly-once run.
const results = await governance.tick()
```

`tick()` is the heartbeat — run it on a schedule, or trigger it from Brain events. Items the Constitution flags `requiresHuman` return `awaiting_human` instead of starting (unless you delegate the gate to the workflow with `requireHumanGate: false`).

## Test / build

```bash
pnpm test    # vitest — guard, compiler, outcome subscriber, full loop
pnpm build   # tsc → dist
```

No Docker or Postgres needed — the suite uses `InMemoryBrainClient` and a fake engine.

## Self-hosting demo

[`example/self-improve.ts`](example/README.md) runs the **whole loop on this repo** — Delphi reviewing, documenting, and assessing its own packages through the real delphi-core engine on Postgres:

```bash
pnpm example:self-improve   # needs Docker; spins a throwaway Postgres
```

Observe → Review (perspectives) → Execute (compile each Action into an exactly-once workflow run) → Measure (Outcome back to the Brain) → writes generated docs + assessments + a loop log to `example/output/`.

## Status

Built, unit-tested, and demonstrated end-to-end on this repo: the Decision→Workflow compiler, Constitution gate, Outcome subscriber, Perspective review (reviewer + tradeoff matrix + decider), LLM + heuristic evaluators, and a self-hosting runner against a live delphi-core engine. Not yet built: an LLM-backed evaluator adapter packaged over `@goatlab/delphi-ai` (the evaluator is structural today — wire `LLMAdapter.chat` into `createLLMPerspectiveEvaluator`), richer `HttpBrainClient` write-back (the Brain REST API is read-mostly; outcomes route through `onOutcome`), and constitution conflict-resolution rules (priority ordering when constraints collide).
