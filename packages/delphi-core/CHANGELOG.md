# @goatlab/delphi-core

## 0.4.0

### Minor Changes

- Add transactional steps — atomic app writes + step completion in a single PG transaction. Steps marked `transactional: true` receive a `ctx.tx` PoolClient; COMMIT = both app data and step result persisted, ROLLBACK = nothing happened. Stronger than replay-based approaches (no crash window). Flag supported at class level and step() override level.

## 0.2.0

### Minor Changes

- Postgres-only architecture: PgConnector replaces BullMQ as default dispatcher. Removed Kysely, js-utils, tslib dependencies. DBOS-parity features (20). Clean API: createEngine({ database, workflows, tenantId }). Type-safe auto-pass for step I/O. Integrated cron scheduling. PG-only matches Redis throughput up to ~5k req/s.
