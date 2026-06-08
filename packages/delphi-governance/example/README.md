# Delphi self-hosting loop

`self-improve.ts` runs the **entire governance loop on this repo** — Delphi
self-assessing and self-documenting its own packages.

```bash
cd packages/delphi-governance
pnpm example:self-improve
```

Requires **Docker** (it spins a throwaway `postgres:16` and removes it on exit).
Set `DATABASE_URL` to use your own Postgres instead.

## What it does

```
Observe   scan packages/delphi-*                     (self-knowledge)
Review    perspective review of the decision         (tradeoffs → approved)
Execute   compile each Action → a delphi-core run     (exactly-once, real engine)
Measure   run.completed → Outcome back to the Brain   (20/20 COMPLETED)
Document  the workflows WRITE generated docs          (example/output/)
```

It wires every layer for real:

- **delphi-core** engine on Postgres, a worker (`WorkflowStepTask` + `PgConnector.listen`), two `FunctionStep` workflows (`documentPackage`, `assessPackage`).
- **delphi-governance** — `InMemoryBrainClient` seeded from the actual packages, `CompileRegistry` mapping `document`/`assess` action types to the workflows, heuristic perspective review (offline), and the outcome subscriber.

## Output (generated, gitignored)

```
example/output/
  narratives/<pkg>.md     # auto-generated package docs (description, file counts, README excerpt)
  assessments/<pkg>.md     # health score + checklist (README/tests/tsconfig/…)
  log.md                   # the loop record: review outcome + per-action outcomes
```

This is the thesis made runnable: **tasks are compiled from decisions**, the
constitution gates them, perspectives surface tradeoffs, and the system writes
down what it learned about itself.
