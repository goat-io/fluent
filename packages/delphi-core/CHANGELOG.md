# @goatlab/delphi-core

## 0.5.0

### Minor Changes

- feat(delphi-core): retry backoff, saga rollback, workflow versioning, timezone-aware scheduling

  - **Retry backoff**: `backoff` property on Step class with exponential/fixed strategies + jitter. `retryAfterMs` BIGINT column on workflow_steps, PgConnector filters by it.
  - **Saga rollback**: `rollback()` method on Step for compensating completed steps when workflow fails. Append-only history — step status stays COMPLETED, rollback logged as events. `onRollbackFailed` callback for alerting.
  - **Workflow versioning**: `getDefinitionForRun()` now uses stored `definitionSnapshot` instead of live registry. In-flight workflows frozen to original definition across deploys.
  - **Timezone-aware scheduling**: `timezone` (IANATimezone type with autocomplete) and `runOnInit` on schedule config. cron-parser evaluates in the specified timezone, handling DST automatically.
  - **TIMESTAMPTZ migration**: All TIMESTAMP columns converted to TIMESTAMPTZ for timezone safety. Heartbeat timeout uses epoch-safe comparison.
  - **Two-generic Workflow fix**: Removed spurious second generic from 8 Workflow declarations across delphi-ui, delphi-express, delphi-bun.
  - **Bug fixes**: broker-e2e unhandled promise rejection, dispatch-handler mock assertion, scheduler flaky test retry.

## 0.4.0

### Minor Changes

- Add transactional steps — atomic app writes + step completion in a single PG transaction. Steps marked `transactional: true` receive a `ctx.tx` PoolClient; COMMIT = both app data and step result persisted, ROLLBACK = nothing happened. Stronger than replay-based approaches (no crash window). Flag supported at class level and step() override level.

## 0.2.0

### Minor Changes

- Postgres-only architecture: PgConnector replaces BullMQ as default dispatcher. Removed Kysely, js-utils, tslib dependencies. DBOS-parity features (20). Clean API: createEngine({ database, workflows, tenantId }). Type-safe auto-pass for step I/O. Integrated cron scheduling. PG-only matches Redis throughput up to ~5k req/s.
