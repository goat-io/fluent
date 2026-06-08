---
name: Brain Kind Taxonomy
description: Generic entity types Brain understands. Each kind has a JSON Schema in brain/schema/.
last-updated: 2026-05-12
owner: engineering
status: draft
---

# Kinds

A "kind" is the typed entity Brain stores in the catalog. Each kind:

- has a JSON Schema at `brain/schema/<kind>.schema.json`
- is created/edited as `catalog/<kind>s/<name>/catalog-info.json` + `README.md`
- can declare relationships to other kinds via `dependsOn[]`, `consumesApis[]`, `componentRepos[]`, etc.

This list is **generic** — applicable to any company. A company instance picks which kinds it populates.

## Current kinds (inherited from the company's catalog v2 schema)

| Kind | What it represents | Examples (any company) |
|------|--------------------|------------------------|
| `system` | A logical system / product line owned by the company | "billing", "alarm hub", "marketing site" |
| `repo` | One source-code repository | any GitHub repo |
| `service` | Software the company deploys but did not write (no own repo) | Keycloak, MongoDB, Artemis |
| `infra` | Cloud / managed service | AWS EKS, RDS, GCP Firestore |
| `external` | Third-party / partner system the company integrates with | Stripe, Sentry, a partner API |
| `product` | Customer-facing physical or digital product | a device SKU, a SaaS plan |
| `team` | R&D org unit | "platform team", "external contractors" |
| `api` | A specific API surface (producer or consumer-resolved) | "billing-api", "stripe-api" |

## Proposed additional kinds (skeleton-only, schemas TBD)

These are common across companies; populate as needed.

| Kind | What it represents |
|------|--------------------|
| `process` | A documented business process |
| `decision` | An ADR — architecture or business decision record |
| `objective` / `key-result` / `kpi` | OKR / KPI tree |
| `risk` | Risk register entry |
| `capability` | Business or technical capability |
| `runbook` | Operational runbook |
| `sla` / `slo` | Service-level agreement / objective |
| `data-asset` | Named data store treated as a first-class asset |
| `classification` | Data classification label (public / pii / life-safety / etc.) |
| `value-stream` | End-to-end flow delivering value |
| `pipeline` | Build / deployment / data pipeline |
| `oncall` | On-call rotation |
| `customer` | Named customer / segment |
| `market` | Geographic or vertical market |

## Adding a new kind

1. Drop a JSON Schema at `brain/schema/<kind>.schema.json`.
2. Append it to the table above with a one-line description.
3. Update `brain/cli/internal/domain/model.go` if the indexer needs to know about it.
4. Document any new relationship fields in `brain/conventions.md`.
