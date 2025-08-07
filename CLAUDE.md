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

### Delphi Package Commands

**Agreement System Testing:**
- `cd packages/delphi && npx vitest run tests/agreement.spec.ts` - Run agreement tests
- `cd packages/delphi && npx vitest run tests/blackboard-cleanup.spec.ts` - Test session cleanup
- `cd packages/delphi && npx vitest run tests/sqlite-concurrency.spec.ts` - Test SQLite concurrency
- `cd packages/delphi && npx vitest run tests/circuit-breaker.spec.ts` - Test circuit breaker

**Run Agreement Examples:**
- `cd packages/delphi && npx tsx examples/agreement-pipeline.ts review --goal "Review PR"` - Code review
- `cd packages/delphi && npx tsx examples/agreement-pipeline.ts architecture` - Architecture decision
- `cd packages/delphi && npx tsx examples/agreement-pipeline.ts refactor` - Refactoring discussion
- `cd packages/delphi && npx tsx examples/model-configuration.ts simple` - Model config example
- `cd packages/delphi && npx tsx examples/agreement-with-cleanup.ts` - Session cleanup example

**Debug & Development:**
- `LOG_LEVEL=debug npx tsx <script>` - Enable debug logging
- `DEBUG=delphi:* npx tsx <script>` - Enable detailed traces
- `OTEL_ENABLED=true npx tsx <script>` - Enable OpenTelemetry tracing

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

## Delphi Agreement System Patterns

### Model Configuration
Models are configured directly in agent definitions for clarity:
```typescript
.withProposer({ 
  id: 'architect',
  model: 'claude-opus-4.1',  // Simple preset
  expertise: ['system-design'],
  weight: 1.0
})
.withReviewer({
  id: 'expert',
  model: { provider: 'openai', model: 'gpt-4o', temperature: 0.7 },  // Custom config
  expertise: ['security']
})
```

### Session Cleanup
Always configure cleanup for production deployments:
```typescript
const orchestrator = new AgreementOrchestrator(config, agents, {
  sessionCleanupConfig: {
    enabled: true,
    retentionDays: 7,
    autoCleanupInterval: 3600000  // 1 hour
  }
})
```

### Strategy Usage
Use predefined strategies for common scenarios:
```typescript
new DiscussionBuilder()
  .useStrategy('code-review')  // Applies optimized model mapping
  .withProposer({ id: 'author', expertise: ['implementation'] })
```
