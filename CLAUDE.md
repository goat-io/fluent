# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Autonomous Development Workflow

- Add failing tests first, then fix them
- Always write a "how to run" the script or test you are creating at the top of the file (i.e: "// npx vitest run ./src/streams.spec.ts")
- Work autonomously in small, testable increments
- Run targeted tests, and lint continuously during development
- Prioritize understanding existing patterns before implementing

## Commands

### Build System

- `pnpm build` - Build all packages (excludes root, queue-node, and ts-package-template)
- `pnpm dev` - Run development mode for all packages in parallel
- `pnpm test` - Run tests for all packages (excludes root, queue-node, and ts-package-template)
- `pnpm lint` - Run linting across all packages

### Package Management

- `pnpm cs` - Run changeset to version packages
- `pnpm cs:version` - Apply changeset versions
- `pnpm cs:publish` - Build and publish packages
- `pnpm clean` - Clean all node_modules
- `pnpm clean:turbo` - Clean turbo cache and node_modules

### Testing

- `pnpm act` - Run GitHub Actions locally using act
- Individual package tests: `cd packages/<package-name> && pnpm test`


## Architecture Overview

This is a monorepo containing the Goat Fluent ecosystem - a TypeScript-based query interface and API generator for multiple databases.

### Core Package Structure

**fluent** - Main package providing:

- `Fluent` class - Core query builder interface
- `TypeOrmConnector` - Primary database connector supporting MySQL, PostgreSQL, MongoDB, SQLite, etc.
- `BaseConnector` - Abstract base for all connectors
- Decorators for schema definition (`@Column`, `@ObjectType`, etc.)
- Query utilities and type definitions

**js-utils** - Browser/Node utilities:

- Collections, Arrays, Objects, Strings manipulation
- HTTP client wrapper (ky-based)
- Promise utilities, error handling
- Date/time utilities, validation utilities

**node-utils** - Node.js-specific utilities:

- JWT handling, security utilities
- Process management, environment handling
- Stream processing, file operations
- Logging, hashing, port utilities

### Database Connectors

- **fluent-firebase** - Firebase/Firestore connector
- **fluent-loki** - LokiJS in-memory database
- **fluent-pouchdb** - PouchDB connector
- **fluent-formio** - Form.io API connector

### Agent Workflow System

- **delphi-core** - Distributed workflow engine (Postgres-only by default, optional BullMQ, DAG+nextStep loops, HITL, ExternalAction exactly-once, event ingestion, cross-tenant dispatch via createDispatcher, transactional steps, worker nodes, COPY FROM bulk inserts)
- **delphi-ai** - Multi-provider LLM adapter (OpenAI/Anthropic/Google/Ollama) + multi-agent consensus + AI tool-call loop with skills
- **delphi-langgraph** - LangGraph StateGraph executor with Postgres checkpointing
- **delphi-sandbox** - Docker sandboxed execution (NetworkMode:none default, allowedDomains iptables, DinD)
- **delphi-ui** - Vite+React+ReactFlow workflow dashboard (SSE, visual editor, metrics, worker monitoring)
- **delphi-brain** - Generic, company-agnostic reasoning engine: git-versioned knowledge base + hybrid FTS5/RAG search + self-evolution skills. **Polyglot package** (Go CLI backend + React frontend). Company identity lives behind `brain.config.json` + `frontend/src/_instance/`. No dependency on delphi-core.
- **delphi-governance** - Governance bridge: compiles approved Brain Decisions/Actions into delphi-core workflow runs (guard → compile → start exactly-once), then records Outcomes back via the `run.completed` engine event. Independent of delphi-core at compile time (binds structurally via `fromEngine()`; delphi-core is an optional peer). `idempotencyKey=action.name`, deterministic `traceId=decision:<name>` for stateless outcome mapping. Pure TS, no Docker/PG to test.

#### Important: delphi-brain is polyglot (Go + React), built via `make` not turbo
- Requires **Go 1.24+ with CGO** (sqlite_fts5) and **Node**; **Ollama** optional (chat/RAG). It is intentionally kept OUT of the `turbo run build|test|lint` pipelines and exposes no `build`/`test`/`lint` npm scripts.
- Build/run: `cd packages/delphi-brain && make build` (or `make serve` / `make serve-chat`), or `pnpm --filter @goatlab/delphi-brain brain:build`.
- Config seam: copy `brain.config.example.json` → `brain.config.json`. The CLI serves it at `GET /api/config` so the React UI de-hardcodes too. Paths/identity are env- and config-driven (`BRAIN_ROOT`, `BRAIN_DB`, `BRAIN_ORG`, `BRAIN_*_DIR`).
- The built binary (`cli/brain`), `node_modules/`, `dist/`, and `brain.db` are gitignored — never commit them.

#### Agent Package Commands

- `cd packages/delphi-core && pnpm test` - Run engine tests (277 tests, needs Docker for testcontainers)
- `cd packages/delphi-core && npx vitest run --exclude="**/load-test*"` - Skip load test (can timeout)
- `cd packages/delphi-ai && pnpm test` - Run AI layer tests (63 tests, no containers needed)
- `cd packages/delphi-sandbox && pnpm test:unit` - Run sandbox unit tests (no Docker)
- `cd packages/delphi-sandbox && pnpm test:integration` - Run Docker integration tests (needs Docker daemon)
- `cd packages/delphi-ui && pnpm dev` - Start dashboard dev server
- `cd packages/delphi-ui && npx tsx example/start.ts` - Start full example (Postgres+Redis+BullMQ+API+3 demo workflows+worker registration)
- `cd packages/delphi-ui && npx playwright test e2e/workflow-editor.spec.ts` - Run visual editor E2E tests (12 tests)
- `k6 run packages/delphi-core/loadtest/k6-workflow.js` - Run k6 load tests (requires test server running)

#### Important: delphi-core uses raw SQL (no ORM)
- Schema defined in `packages/delphi-core/src/entities/Database.ts` as plain TS interfaces
- No decorators, no reflection, no `reflect-metadata` needed
- JSON fields stored as TEXT with `toJson()`/`fromJson()` helpers
- Always rebuild (`npx tsc -p tsconfig.build.json`) before running tests in downstream packages

#### Publishing delphi-core
- **ALWAYS use `pnpm publish --no-git-checks`** — never `npm publish` (leaks `workspace:*` in deps)
- Always `rm -rf dist` before building for publish
- Use `npx tsc -p tsconfig.build.json` for clean build (excludes tests)
- Always rebuild (`npx tsc`) before running tests in downstream packages

### Additional Packages

- **formio-utils** - Form.io form parsing and validation
- **uploads** - File upload handlers (S3, GCP, Azure)
- **queue-core** - Queue/job processing abstractions
- **tasks-\*** - Task processing adapters (GCP Cloud Tasks, Hatchet)

### Development Dependencies

- **turbo** - Monorepo build system
- **changesets** - Version management and publishing
- **pnpm** - Package manager with workspaces

### Key Patterns

1. **Connector Pattern**: All database integrations extend `BaseConnector` and implement `FluentConnectorInterface`
2. **Fluent Interface**: Query building uses method chaining (`.where().orderBy().limit()`)
3. **TypeORM Integration**: Primary SQL/NoSQL support through TypeORM with custom query builders
4. **Decorator-based Schema**: Uses decorators for entity definition and API generation
5. **Monorepo Structure**: Shared utilities in js-utils/node-utils, specialized connectors in separate packages

### Release Process

Uses changesets for versioning. Release dependency chain: js-utils → node-utils → fluent (other packages depend on these core packages).

## Common TypeScript/Build Fixes

### ES Module Import Issues
All relative imports must use `.js` extension:
```typescript
// ❌ Wrong
import { Something } from './module'

// ✅ Correct
import { Something } from './module.js'
```

### Zod Schema Fixes
Always specify both key and value types for `z.record()`:
```typescript
// ❌ Wrong
z.record(z.unknown())

// ✅ Correct
z.record(z.string(), z.unknown())
```

