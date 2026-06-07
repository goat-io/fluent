---
name: Brain JSON Schemas
description: Generic JSON Schema definitions — one per kind. Source of truth for catalog-info.json shape.
last-updated: 2026-05-12
owner: engineering
status: active
---

# Schemas

One JSON Schema per kind. Each `catalog/<kind-plural>/<name>/catalog-info.json` file must validate against the matching schema here.

## Files

| Schema | Kind | Covers |
|--------|------|--------|
| [`repo.schema.json`](repo.schema.json) | `repo` | Source-code repositories |
| [`system.schema.json`](system.schema.json) | `system` | C4 Level 1 systems (manifests) |
| [`service.schema.json`](service.schema.json) | `service` | Deployed software with no own source repo (Keycloak, MongoDB, …) |
| [`infra.schema.json`](infra.schema.json) | `infra` | Cloud / managed-service primitives (AWS EKS, RDS, …) |
| [`external.schema.json`](external.schema.json) | `external` | Third-party / partner systems |
| [`product.schema.json`](product.schema.json) | `product` | Customer-facing products |
| [`team.schema.json`](team.schema.json) | `team` | R&D org units |
| [`api.schema.json`](api.schema.json) | `api` | Named API surfaces (producer or consumer-resolved) |
| [`_shared/dependency.schema.json`](_shared/dependency.schema.json) | — | `dependsOn[]` edge object |
| [`_shared/frontmatter.schema.json`](_shared/frontmatter.schema.json) | — | YAML frontmatter on indexed `.md` files |
| [`CATALOG_SCHEMA.md`](CATALOG_SCHEMA.md) | — | Long-form schema reference + design rationale |

## Pending

These kinds are listed in [`../kinds.md`](../kinds.md) but don't yet have machine-readable schemas:
`capability`, `valueStream`, `kpi`, `objective`, `keyResult`, `oncall`, `runbook`, `sla`, `slo`, `dataAsset`, `classification`, `dataPipeline`, `process`, `decision`, `risk`, `customer`, `market`. Add the relevant `<kind>.schema.json` when populating those buckets.

## Status

The Go structs in `brain/cli/internal/domain/model.go` are still the de-facto source of truth for the indexer. These JSON Schemas mirror them and allow non-Go tooling (CI validators, editor plugins, the frontend) to validate `catalog-info.json` directly. When the two disagree, fix the JSON Schema and the Go struct in the same commit.

## Conventions

- One file per kind, named `<kind>.schema.json`
- `$schema: https://json-schema.org/draft/2020-12/schema`
- `$id: https://delphi.goat.io/brain/schema/<kind>.schema.json` (placeholder; rename when Brain is extracted)
- Shared sub-schemas live in `_shared/` and are referenced via `$ref`
- Most fields are `additionalProperties: true` for now — tighten as the schema matures
