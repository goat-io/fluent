# @goatlab/delphi-core

## 0.2.0

### Minor Changes

- Postgres-only architecture: PgConnector replaces BullMQ as default dispatcher. Removed Kysely, js-utils, tslib dependencies. DBOS-parity features (20). Clean API: createEngine({ database, workflows, tenantId }). Type-safe auto-pass for step I/O. Integrated cron scheduling. PG-only matches Redis throughput up to ~5k req/s.
