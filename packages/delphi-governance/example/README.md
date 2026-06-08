# Delphi self-hosting loop

`self-improve.ts` runs the **entire governance loop on this repo** — Delphi
self-assessing and self-documenting its own packages.

```bash
cd packages/delphi-governance
pnpm example:self-improve
```

Requires **Docker** (it spins a throwaway `postgres:16` and removes it on exit).
Set `DATABASE_URL` to use your own Postgres instead.

**Real reasoning, no API key.** If the `claude` CLI is installed and
authenticated, both the perspective review AND the documentation/assessment
workflows run through `claude -p` (your Claude subscription) — producing genuine,
code-grounded architectural narratives and critical, honestly-scored
assessments (it reads each package's README, exports, and file tree).

Knobs:
- `DELPHI_HEURISTIC=1` — skip the CLI, use the deterministic offline evaluator/templates.
- `DELPHI_MODEL=haiku|sonnet|opus` — analysis model (default `sonnet`). `haiku` is much faster.
- `DELPHI_CONCURRENCY=N` — parallel `claude -p` workers (default 5).

With `sonnet` this makes ~25 model calls and takes several minutes; a `claude`
failure on any step falls back to a template so the step still completes.

## What it does

```
Observe   scan packages/delphi-*                     (self-knowledge)
Review    perspective review of the decision         (tradeoffs → approved)
Execute   compile each Action → a delphi-core run     (exactly-once, real engine)
Measure   run.completed → Outcome back to the Brain   (20/20 COMPLETED)
Document  the workflows WRITE generated docs          (example/output/)
Remember  index the self-docs into the Delphi Brain   (queryable institutional memory)
```

The final **Remember** phase shells out to the built Delphi Brain binary
(`packages/delphi-brain/cli/brain`, FTS5 — no Ollama needed) to index the
generated docs, so the Brain now *knows about its own packages* and they're
searchable. If the binary isn't built, that phase is skipped gracefully.

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
