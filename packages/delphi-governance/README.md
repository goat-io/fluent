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
| `createOutcomeSubscriber` | the Measure seam — an `onEngineEvent` handler |
| `createGovernance` | wires it all together (`.tick()`, `.onEngineEvent`) |

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

## Status

First slice: the Decision→Workflow compiler + Constitution gate + Outcome subscriber, fully unit-tested. Not yet built: richer `HttpBrainClient` write-back (the Brain REST API is read-mostly today; outcomes route through `onOutcome`), Perspectives/multi-agent review (will compose `@goatlab/delphi-ai`'s `AgreementOrchestrator`), and constitution conflict-resolution rules.
