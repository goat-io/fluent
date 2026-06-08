---
name: Delphi Brain — Generic Company-Reasoning Framework
description: Reusable, company-agnostic skeleton — schemas, conventions, CLI, skills, hybrid FTS5/RAG search, React UI — for documenting and reasoning about any company as agent-readable data
last-updated: 2026-06-07
owner: engineering
status: active
tags: [brain, delphi, framework]
audience: [agent, engineer]
system: cross-cutting
---

# Delphi Brain

`@goatlab/delphi-brain` is the framework that turns "documenting and reasoning about a company" into structured, agent-readable data: a git-versioned knowledge base with hybrid keyword (FTS5) + semantic (RAG) search, a self-evolution skill loop, and a React UI.

It is **company-agnostic by design**. Nothing in this package mentions any specific company. A company's data and identity live behind two seams:

- **`brain.config.json`** — instance config (org name, description, branding, source links, default GitHub org, chat assistant). See [`brain.config.example.json`](brain.config.example.json). The CLI serves it at `GET /api/config` so the frontend de-hardcodes too.
- **`frontend/src/_instance/`** — the UI instance seam (branding, domain colours, curated library, lenses). Swap this folder per company.

Catalog/narrative content (the actual `kind:` entries) lives in a company's own brain repo at the instance root — pointed to via `BRAIN_ROOT` / `BRAIN_CATALOG_DIR`. This package ships the *framework*, not the data.

> Extracted from an internal company "brain" and made fully generic. It lives in the `fluent` monorepo as an independent, polyglot package (Go backend + React frontend) and can be split into its own repo later.

## Layout

| Dir | Purpose |
|-----|---------|
| `cli/` | Go CLI — repo registry, doc indexer, FTS5 search, vector embeddings, REST API, RAG chat. See [`cli/README.md`](cli/README.md). |
| `frontend/` | React UI — talks to the CLI's API. Generic shell; company-specific bits isolated under `frontend/src/_instance/`. |
| `schema/` | JSON Schema per kind. Source of truth for what a `system`, `repo`, `team`, `decision`, etc. looks like. |
| `skills/` | Generic Claude Code skills (`analyze-repo`, `catchup`, `document-learning`, `brain-evolve`, `propose-*`, …). |
| `kinds.md` | Generic kind taxonomy — what entity types Brain understands. |
| `conventions.md` | Generic file/folder/frontmatter conventions every entry follows. |
| `brain.config.example.json` | The per-company config seam — copy to `brain.config.json`. |

## Quick start

Requires **Go 1.24+ (CGO)**, **Node**, and (for chat/RAG) **Ollama**.

```bash
cp brain.config.example.json brain.config.json   # fill in your org
make serve        # API + UI, Ollama-free (FTS5 keyword search only)
make serve-chat   # adds Ollama-backed chat panel + RAG hybrid search
```

The Go binary is a make/`go build` target — this package intentionally stays out of the monorepo's `turbo` JS pipelines. Build it explicitly with `pnpm --filter @goatlab/delphi-brain brain:build` or `make build`.

## Semantic search + chat

Brain ships a local RAG layer alongside FTS5:

- **Storage**: `rag_chunks` table in the same SQLite DB. Float32 BLOB embeddings (768-dim from `nomic-embed-text` via Ollama). ~5 KB per chunk.
- **Search**: in-memory cosine KNN. Sub-millisecond over ~10K chunks. Swap to `sqlite-vec` only if the corpus exceeds ~100K chunks — schema is BLOB-compatible.
- **Ingestion**: indexer chunks every `.md` (~800 char paragraphs with 100 char overlap), embeds, and persists. Cache hits on `content_hash` skip re-embedding (incremental).
- **Endpoints**: `GET /api/rag/query?q=...&k=10`, `GET /api/rag/stats`. CLI mirror: `brain rag query "..."`, `brain rag stats`.
- **Chat panel** uses pre-flight RAG: every user question first hits `rag.Query()` and the top-k chunks are injected as a `system` message before the LLM call. The chat system prompt is built from `brain.config.json` (assistant name + org description) — never hardcoded.
- **Optional**: Ollama. If the daemon is down or the model isn't pulled, RAG silently degrades (FTS5 / facets / backlinks keep working). Pull both models once: `ollama pull nomic-embed-text` + `ollama pull qwen3:4b`.

The SQLite DB (`brain.db` at the instance root; path overridable via `BRAIN_DB`) is **not** shipped in this framework package — `make index` builds it from your instance content.

## Configuration

All paths and identity are environment- and config-driven (no company baked in):

| Setting | Env | Config (`brain.config.json`) | Default |
|---|---|---|---|
| Instance root | `BRAIN_ROOT` | — | auto-detected (config/schema marker) |
| DB path | `BRAIN_DB` | — | `<root>/brain.db` |
| Catalog dir | `BRAIN_CATALOG_DIR` | — | `catalog` |
| Narratives dir | `BRAIN_NARRATIVES_DIR` | — | `narratives` |
| Schema dir | `BRAIN_SCHEMA_DIR` | — | `schema` |
| Telemetry dir | `BRAIN_TELEMETRY_DIR` | — | `telemetry` |
| GitHub org | `BRAIN_ORG` | `github.defaultOrg` | _(unset)_ |
| Chat model | `BRAIN_MODEL` | `chat.model` | `qwen3:4b` |
| Embed model | — | `embed.model` | `nomic-embed-text` |
