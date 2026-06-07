# Brain

Service registry, document indexer, and API server for the company's knowledge base.

Brain is an internal CLI tool that manages the company's 171 GitHub repositories, indexes all markdown documentation with full-text search, and serves it via a REST API.

## Prerequisites

- Go 1.24+
- [GitHub CLI](https://cli.github.com/) (`gh`) — for repo import and cloning
- CGO enabled (required by SQLite driver)

## Build

```bash
cd brain/cli
go build -o brain .
```

## Usage

```
brain [command]
```

Built with [Cobra](https://github.com/spf13/cobra) — every command supports `--help`, and shell completion is available via `brain completion`.

### Repository Management

```bash
brain repo import [org]                          # Import all repos from GitHub org (default: the company)
brain repo sync [--skip-specs]                   # Full sync: GitHub + .brain.yml + catalog backfill
brain repo add <name> <url> <domain>             # Add a repo manually
brain repo list [--domain=X] [--status=X]        # List repos (filterable)
brain repo show <name>                           # Show repo details + services + tags
brain repo update <name> field=value ...         # Update repo fields
```

### Cloning

All bulk clone commands run in parallel with configurable batch size.

```bash
brain clone repo <name> [name2 ...]              # Clone specific repos to repos/
brain clone all [--batch=10]                     # Clone all non-archived repos in parallel
brain clone domain <domain> [--batch=10]         # Clone all repos in a domain in parallel
```

### Services & Protocols

```bash
brain svc add <name> [repo=X type=service hosting=AWS ...]
brain svc list [--type=X] [--status=X]
brain svc show <name>

brain proto add <name> [type=custom transport=TCP port=61814 ...]
brain proto list
```

Aliases: `service` for `svc`, `protocol` for `proto`.

### Tagging

```bash
brain tag <repo|service|protocol> <name> <tag>
```

### Document Indexing & Search

```bash
brain index [--root=<path>]                      # Index all markdown files with YAML frontmatter
brain serve [--port=7613] [--root=<path>]        # Start HTTP API server
```

### Queries & Stats

```bash
brain query "SELECT name, domain FROM repos WHERE status = 'active'"
brain stats                                      # Summary dashboard
```

### Shell Completion

```bash
brain completion bash > /etc/bash_completion.d/brain    # Bash
brain completion zsh > "${fpath[1]}/_brain"              # Zsh
brain completion fish > ~/.config/fish/completions/brain.fish
```

## API Endpoints

When running `brain serve`, the following endpoints are available:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List documents. Query params: `domain`, `catalog=true`, `q=<search>` |
| GET | `/api/documents/<path>` | Get document metadata + markdown content |
| GET | `/api/catalog` | List catalog entries (`catalog/` docs) |
| GET | `/api/catalog/:domain/:name` | Get specific catalog entry — includes `catalog-info.json` spec + optional `openapi.json` |
| GET | `/api/repos` | All catalog entries enriched with their `catalog-info.json` spec |
| GET | `/api/repos/:name` | Single repo with parsed JSON fields + spec + openapi |
| GET | `/api/search?q=<term>` | Full-text search with snippets. Optional `limit` param |
| GET | `/api/stats` | Document and domain statistics |
| GET | `/api/domains` | List all domains with document counts |
| GET | `/api/dashboard` | Combined stats overview |
| GET | `/api/architecture` | Architecture seed data (services, databases, devices, personas, target state, glossary) |
| GET | `/api/architecture/graph` | Pre-computed dependency graph (nodes/edges/zones/lanes) derived from all catalog entries |
| GET | `/api/architecture/systems` | C4 Level 1 system-context view — system manifests joined with members + cross-system edges |
| GET | `/api/architecture/:section` | Single architecture seed file by name |
| POST | `/api/chat` | Streamed chat (SSE) — searches Brain for context, calls Ollama |

CORS is restricted to `localhost` origins. No authentication (localhost-only use).

## `.brain/` Spec / catalog `catalog-info.json`

Each catalog entry has a `catalog-info.json` (and teams may also place `.brain/spec.json` in their repo root for `brain repo sync` over the GitHub API). Both follow the same schema — see [`brain/schema/CATALOG_SCHEMA.md`](../schema/CATALOG_SCHEMA.md) for the full reference. Summary:

```json
{
  "name": "cp-aurora-backend",
  "kind": "repo",
  "description": "ICC backend — alarm management service",
  "system": "icc",
  "layer": "domain",
  "domain": "icc",
  "type": "service",
  "lifecycle": "production",
  "team": "External (Spain + Sweden)",
  "dependsOn": [
    {"target": "mongodb-icc", "kind": "service", "protocol": "MongoDB wire", "port": 30001, "purpose": "data persistence"},
    {"target": "artemis", "kind": "service", "protocol": "AMQP", "port": 61616, "purpose": "JMS messaging"},
    {"target": "keycloak", "kind": "service", "protocol": "HTTPS", "port": 443, "purpose": "JWT validation"}
  ],
  "providesApis": ["icc-jms-events"],
  "consumesApis": ["keycloak-jwks"],
  "tags": ["java", "spring-boot", "aws", "eks"],
  "links": [
    {"title": "Runbook", "url": "https://wiki.example.com/icc/runbook"}
  ]
}
```

`kind` is one of `repo | service | infra | external`. `dependsOn` items are objects (not strings). All other fields are optional.

### Sync Priority Chain

`brain repo sync` merges metadata from three sources with this priority:

1. **`.brain/spec.json`** (highest) — team-owned, in the repo
2. **GitHub topics** — convention: `domain-icc`, `team-madrid`, `status-production`
3. **Brain catalog entries** — backfill from `catalog/` docs

Higher-priority sources override lower ones. Use `--skip-specs` to skip the GitHub API calls (faster, uses cached data).

## Architecture

Brain uses [hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) (ports and adapters):

```
main.go                          Composition root — wires everything

internal/domain/
  model.go                       Entities, value objects, domain logic
  port.go                        Port interfaces (contracts)

internal/app/
  app.go                         Application service container
  repo.go, service.go, ...       Use cases — orchestrate domain through ports

internal/adapter/
  sqlite/                        Driven adapter: SQLite persistence
  github/                        Driven adapter: GitHub CLI wrapper
  cli/                           Driving adapter: Cobra CLI commands
  httpapi/                       Driving adapter: Fiber HTTP server
```

**Dependency rule:** Domain depends on nothing. App depends only on domain. Adapters depend on domain + app. `main.go` is the only file that knows all concrete types.

### Database

SQLite with WAL mode. Six tables:

| Table | Purpose |
|-------|---------|
| `repos` | Repository registry (name, URL, domain, status, language, team) |
| `services` | Service/component registry (type, hosting, port, protocol, dependencies) |
| `protocols` | Communication protocol definitions |
| `tags` | Flexible entity tagging |
| `documents` | Indexed markdown metadata (frontmatter fields, content hash) |
| `documents_fts` | FTS5 virtual table with porter stemming for full-text search |

The database file (`brain.db`) lives in `brain/cli/` alongside the Go source.

## Key Design Decisions

- **Cobra CLI** — proper subcommands, typed flags, built-in help, shell completion
- **Parallel cloning** — batch-based concurrency with configurable `--batch` size (default 10)
- **Single binary** — all functionality compiles into one executable with embedded SQLite
- **Content hashing** — MD5 hash skips re-indexing unchanged markdown files
- **Upsert everywhere** — all write operations are idempotent via `ON CONFLICT DO UPDATE`
- **FTS5 with porter stemming** — search for "alarm" also matches "alarms", "alarming"
- **Catalog awareness** — files under `catalog/` are flagged for specialized queries
- **YAML frontmatter extraction** — lightweight parser (not full YAML) for markdown metadata
