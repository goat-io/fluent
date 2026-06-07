---
name: Catalog Entry Schema
description: Schema for all catalog entries (repos, services, infra, external, product, team) and system manifests
last-updated: 2026-05-05
owner: engineering
status: draft
---

# Catalog Entry Schema

Defines the structure for every node in the company's architecture graph. Every component — whether it's a the company-owned repo, a piece of self-deployed software (Keycloak, MongoDB), a cloud service (AWS RDS), or a third-party system (Navision) — gets a catalog entry with the same base shape.

This makes every node in the graph clickable and self-describing. A repo's `dependsOn` no longer points at opaque strings (`infra:aws-eks`); it points at another catalog entry that has its own page, dependencies, and links.

## Entry kinds

19 kinds today (proposal §4.2 ceiling is ~24). All share a common base; some have kind-specific fields.

**Architectural** (render in arch diagrams):

| `kind` | What it is | Folder |
|---|---|---|
| `repo` | the company source repo | `catalog/<kind>/<name>/` |
| `service` | the company-deployed software with no own repo (Keycloak, MongoDB, Artemis, MariaDB, Asterisk, Redis, ...) | `catalog/infra/<name>/` |
| `infra` | Cloud platform or managed service (AWS EKS, AWS RDS, AWS Aurora, GCP Firestore, ...) | `catalog/infra/<name>/` |
| `external` | Third-party / partner system (Navision, APNs, Sentry, ARC partners) | `catalog/external/<name>/` |
| `product` | Customer-facing physical product (Eliza A150, Abby, Amy, Enzo, mBox, ...). Composes one-or-more repos and may communicate directly with backends over device protocols. | `catalog/products/<name>/` |
| `system` | Cohesive group of catalog entries the business names (ICC, ICO, IoT Backend, ...). C4 Level 1. | `catalog/systems/<id>/` |
| `api` | API surface published by a producer repo. One entry per host repo holding its declared operations. Promoted from `providesApis: [...]` strings in Phase 1.3. Spec: `providedBy[]`, `operations[]`. | `catalog/apis/<repo>-api/` |

**Organisational / operational** (don't render in arch diagrams; surface in team / OKR / drawer views):

| `kind` | What it is | Folder |
|---|---|---|
| `team` | R&D org unit. External, Internal, IoT Core, Platform. | `catalog/teams/<slug>/` |
| `slo` | Internal service-level objective (target + window + governs[] components). | `catalog/slos/<name>/` |
| `oncall` | Paging / escalation policy. Annotated with PagerDuty / Opsgenie ids. | `catalog/oncall/<name>/` |
| `runbook` | Operational playbook attached to one or more components. | `catalog/runbooks/<name>/` |
| `dataAsset` | Logical data store (one Mongo collection family, one SQL Server cluster, one S3 bucket family). | `catalog/data-assets/<name>/` |
| `classification` | Sensitivity tag attached to dataAssets (life-safety, pii, public, …). | `catalog/classifications/<name>/` |
| `dataPipeline` | ETL / streaming pipeline producing or consuming dataAssets. | `catalog/pipelines/<name>/` |
| `capability` | Business outcome the company delivers (reliable-alarm-reception, safe-fota). | `catalog/capabilities/<name>/` |
| `valueStream` | End-to-end customer flow with stages (alarm-path, fota-rollout). | `catalog/value-streams/<name>/` |
| `kpi` | Universal metric — unit, target, current value. SLO is a sub-kind. | `catalog/kpis/<name>/` |
| `sla` | Contractual service-level agreement (TSA QSF, DORA, EN 50134). | `catalog/slas/<name>/` |
| `objective` | Quarterly outcome statement. Append-only per quarter (period field). | `catalog/objectives/<name>/` |
| `keyResult` | Measurable result attached to an Objective; references KPI/SLO. | `catalog/key-results/<name>/` |

Plus one non-node entity (legacy — being promoted to `kind: system`):

| Entity | Purpose | Folder |
|---|---|---|
| **System manifest** | Aggregates entries that belong to the same system (ICC, ICO, IoT Backend, …). Drives the C4 L1 system-context view. Stored as a `kind: system` catalog entry. | `catalog/systems/<id>/catalog-info.json` |

## Files per entry

| File | Required for | Purpose |
|---|---|---|
| `catalog-info.json` | all kinds | Structured metadata (this schema) |
| `README.md` | all kinds | Human analysis with frontmatter |
| `openapi.json` | repos that expose HTTP/GraphQL APIs | API surface |

## Common fields (every kind)

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Must match folder name. Globally unique across catalog |
| `kind` | enum | yes | `repo` \| `service` \| `infra` \| `external` \| `product` \| `team` \| `system` \| `api` \| `slo` \| `oncall` \| `runbook` \| `dataAsset` \| `classification` \| `dataPipeline` \| `capability` \| `valueStream` \| `kpi` \| `sla` \| `objective` \| `keyResult` |
| `description` | string | yes | One-line description |
| `system` | string | yes | System this entry belongs to.. Must match a `kind: system` entry id under `catalog/systems/`. Use `cross-cutting` for shared infra not owned by one system. `kind: team` always uses `cross-cutting` |
| `layer` | enum | yes | `device` \| `edge` \| `domain` \| `platform` \| `data` \| `cross-cutting` \| `business` \| `r-and-d` (see [Layers](#layers)) |
| `tags` | string[] | optional | Free-form discovery tags |
| `links` | `{title, url}[]` | optional | External links (GitHub, vendor docs, dashboards) |
| `dependsOn` | `Dependency[]` | optional | Outbound edges (see [Dependency object](#dependency-object)) |
| `consumedBy` | string[] | optional | Inbound — array of catalog entry names. Auto-derivable but allows manual annotation |

## Dependency object

Each item in `dependsOn` is an object, not a bare string. `target` references another catalog entry by name.

| Field | Type | Required | Notes |
|---|---|---|---|
| `target` | string | yes | Must match `name` of another catalog entry (`repo` / `service` / `infra` / `external`) |
| `kind` | enum | yes | Mirrors the target's kind. Lets graph builders filter without a second lookup |
| `protocol` | string | optional | `HTTP` \| `HTTPS` \| `AMQP` \| `JMS` \| `gRPC` \| `MongoDB wire` \| `MQTT` \| `SIP` \| `UDP` \| `TCP` \| `MongoDB` \| `WebSocket` \| `Socket.IO` \| `WebRTC` etc. Free-form string |
| `port` | number | optional | TCP/UDP port number |
| `purpose` | string | optional | Short why-this-edge-exists string for edge labels |

Edges no longer carry `managed`/`platform`/`deployment` — that lives on the target's own catalog entry.

### Example

```json
"dependsOn": [
  {"target": "cp-aurora-backend", "kind": "repo", "protocol": "AMQP", "port": 61616, "purpose": "publish notifications"},
  {"target": "keycloak", "kind": "service", "protocol": "HTTPS", "port": 443, "purpose": "JWT validation"},
  {"target": "aws-eks", "kind": "infra", "purpose": "compute platform"},
  {"target": "navision", "kind": "external", "protocol": "HTTPS", "purpose": "customer master data"}
]
```

## Kind-specific fields

### `kind: repo` — the company source repo

(Existing fields, kept as-is.)

| Field | Type | Required | Notes |
|---|---|---|---|
| `domain` | string | yes | Folder under `catalog/`: `icc`, `ico`, `iot-backend`, `apps`, `embedded`, `identity`, `infrastructure`, `data`, `labs`, `legacy`, `recruiting`, `docs` |
| `type` | enum | yes | `app` \| `service` \| `library` \| `firmware` \| `tool` \| `config` |
| `lifecycle` | enum | yes | `production` \| `prototype` \| `sunset` \| `dead` \| `unknown` |
| `language` | string[] | optional | Primary language(s). Controlled enum: `java` \| `typescript` \| `javascript` \| `python` \| `csharp` \| `go` \| `rust` \| `kotlin` \| `swift` \| `c` \| `cpp` \| `shell` \| `dart` \| `php` \| `ruby` \| `elixir` \| `erlang` \| `scala` \| `dockerfile` \| `html` \| `css` \| `sql`. Multi-value when a repo legitimately mixes languages (e.g. `["c", "cpp"]` for `dpd-A150-software-package`). Brain prefers this field over the legacy single-language tag. Promote to `kind` only when per-language ownership / EOL tracking is needed (proposal §7) |
| `team` | string | yes | Owning team |
| `collaborators` | `{name, role, github, email?}[]` | optional | |
| `providesApis` | string[] | optional | API names this repo exposes |
| `consumesApis` | string[] | optional | API names this repo consumes |
| `deployment` | object | optional | `{cloud, compute, region, environments[], cicd, deployMethod}` |
| `observability` | object | optional | `{logging, metrics, errorTracking, alerting, healthEndpoint}` |
| `security` | object | optional | `{findings[], hasHardcodedSecrets, hasMissingAuth, hasLockFile, tlsVerificationDisabled}` |

### `kind: service` — the company-deployed software, no own repo

For things like Keycloak, MongoDB, Artemis, MariaDB, Asterisk, Kamailio, Redis (self-managed), HEP server, Hazelcast, Monstache, OpenSearch, CoTURN.

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | optional | Deployed version (e.g. `"21"`, `"10.x"`, `"2.31.2"`) |
| `deployedBy` | string[] | yes | Catalog `kind: repo` names that provision this service (helm-charts, terraform, docker-pbx, ...) |
| `runsOn` | string | optional | Catalog `kind: infra` name where this service runs (e.g. `aws-eks`, `aws-ecs-fargate`, `on-premise-iis`) |
| `vendor` | string | optional | Upstream vendor/project (e.g. `Apache`, `Red Hat`, `MongoDB Inc.`) |
| `category` | string | optional | `database` \| `cache` \| `message-broker` \| `identity` \| `pbx` \| `search` \| `cdc` \| `turn` |

### `kind: infra` — cloud platform or managed service

For AWS / GCP / on-premise platform primitives. One catalog entry per *service type*, not per instance (e.g. one `aws-rds` entry, even if the company runs five RDS instances). Per-instance disambiguation via the `instance` field on the consuming repo's `dependsOn` item if needed.

| Field | Type | Required | Notes |
|---|---|---|---|
| `provider` | enum | yes | `aws` \| `gcp` \| `on-premise` |
| `service` | string | yes | Short identifier — `eks`, `ecs-fargate`, `lambda`, `rds`, `aurora`, `aurora-serverless`, `dynamodb`, `elasticache`, `s3`, `sqs`, `sns`, `ses`, `transit-gateway`, `firestore`, `cloud-run`, `cloud-functions`, `iis`, `vm` |
| `managed` | bool | yes | `true` = vendor-operated. `false` = the company-operated infrastructure (e.g. on-premise) |
| `region` | string | optional | e.g. `eu-north-1`, `eu-central-1` |

### `kind: external` — third-party / partner

For Navision, APNs, FCM, Sentry, Datadog, Google Maps, Google Geocoding, Twilio, Generic.se, CSL/Vodafone/Maingate, ARC partner networks.

| Field | Type | Required | Notes |
|---|---|---|---|
| `vendor` | string | yes | Vendor name |
| `category` | enum | yes | `push` \| `sms` \| `email` \| `maps` \| `erp` \| `crm` \| `monitoring` \| `telecom` \| `partner-arc` \| `payment` \| `identity` |
| `integrationMethod` | string | optional | `REST API` \| `SOAP` \| `SIP/SCAIP` \| `VPN tunnel` \| `webhook` \| `file transfer` |
| `contractType` | string | optional | `vendor` \| `partner` \| `customer-supplied` |

### `kind: product` — customer-facing physical product

For the company-branded and partner-branded devices the customer actually buys (Eliza A150, Eliza S+, Abby, Amy, Enzo, Vibby OAK, mBox 9200, i10 Smoke, i10 CO, Epilepsy sensor, Doro 450, ...). A product is the **composition node** that ties together the firmware repos, backend services, and external systems delivering one shippable thing.

`componentRepos[]` is the canonical edge — every `repo` listed there is what makes this product real. Anything else (systems, languages, databases, infrastructure footprint) is **derived** by traversing those repos' own catalog entries.

| Field | Type | Required | Notes |
|---|---|---|---|
| `vendor` | string | yes | `the company` for own products; `Doro` / `Vibby` / `i10` etc. for partner-branded |
| `category` | enum | yes | `home-hub` \| `radio-peripheral` \| `mobile-alarm` \| `partner-device` |
| `lifecycle` | enum | yes | `production` \| `new` \| `sunset` \| `dead` |
| `image` | string | optional | Path under `/products/...` (reuse images served by the architecture-app under `brain/frontend/public/products/`) |
| `marketing_url` | string | optional | example.com product page |
| `componentRepos` | string[] | yes | Catalog `repo` names that ship/run/serve this product (firmware + backend services). Use `_TBD_` placeholder if unknown |
| `communicatesWith` | `Dependency[]` | optional | Direct device→backend edges this product makes over the wire (protocol/port/purpose). Same shape as `dependsOn` |
| `variantOf` | string | optional | If this product is a variant of another (e.g. `eliza-s-plus.variantOf = eliza-a150`), point at the canonical product. Variants share `componentRepos` by default |

#### Edge direction

Products **own** their repos via `componentRepos`. Repos do NOT carry a `products: [...]` field — the relationship is single-source-of-truth on the product side and inverted by view code when "which products does this repo serve?" is needed.

### `kind: system` — the company system (C4 Level 1)

Systems aggregate catalog entries that belong to a named cohesive group (ICC, ICO, IoT Backend, …). One entry per system. Drives the C4 L1 system-context view via `GET /api/architecture/systems` — Brain joins these manifests with member entries (anything whose `system` field matches `name`) and derives cross-system edges from member `dependsOn`.

`system` field on a `kind: system` entry is always `cross-cutting` (a system can't belong to itself).

| Field | Type | Required | Notes |
|---|---|---|---|
| `displayName` | string | yes | Human-readable system name shown in UI (e.g. `i-care connect (ICC)`) |
| `boundary` | string | yes | Physical/logical scope (`Madrid / AWS EKS`, `Vietnam / On-premise`, `AWS (multi-account)`) |
| `c4Kind` | enum | yes | `system` (the company-internal) \| `external_system` (drawn outside the boundary) |
| `ownerTeam` | string | yes | Team display name (`External (Spain + Sweden)`, `Platform`, …). Phase 1.1 added `kind: team` entries — this field will become a `dependsOn`-style edge once Phase 6 stitcher lands |
| `externalActors` | string[] | optional | Persona ids from `narratives/architecture/personas.json` (`arc-operator`, `family-carer`, `device-user`, …) |
| `entryPoints` | `{kind, protocol?, port?, purpose?, exposedBy?}[]` | optional | Public surface — how other systems / actors enter this system. `exposedBy` references a member catalog entry name. `kind` is `ingress` \| `egress` |

#### Example

```json
{
  "name": "icc",
  "kind": "system",
  "description": "Centralised alarm hub. Receives alarms from devices and SCAIP agents, manages operator workflow via Gladius, routes to ARC responders.",
  "system": "cross-cutting",
  "layer": "domain",
  "displayName": "i-care connect (ICC)",
  "boundary": "Madrid / AWS EKS (eu-north-1)",
  "c4Kind": "system",
  "ownerTeam": "External (Spain + Sweden)",
  "externalActors": ["arc-operator"],
  "entryPoints": [
    {"kind": "ingress", "protocol": "HTTPS", "port": 443, "purpose": "Operator UI", "exposedBy": "cp-aurora-gladius"},
    {"kind": "ingress", "protocol": "GraphQL", "port": 7600, "purpose": "ICG mobile gateway", "exposedBy": "cp-icc-caronte"}
  ]
}
```

### `kind: capability` — business outcome

What the company chooses to deliver, independent of how. Capabilities are realized by Systems / Components / Products.

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerTeam` | string | yes | Team accountable for the capability |
| `realizedBy` | `Dependency[]` | yes | Systems / components that deliver it |
| `valueStreams` | string[] | optional | Names of `kind: valueStream` entries this capability participates in |

### `kind: valueStream` — end-to-end customer flow

The flow that produces the customer outcome the Capability promises. Spans multiple Systems.

| Field | Type | Required | Notes |
|---|---|---|---|
| `realizes` | `Dependency[]` | yes | Capabilities this value-stream delivers |
| `stages` | `{name, components[]}[]` | yes | Ordered stages (Trigger / Transport / Ingest / …) with the components in each |
| `measuredBy` | `Dependency[]` | optional | SLOs that watch this value-stream |
| `ownerTeam` | string | yes | Team accountable end-to-end |

### `kind: kpi` — universal metric

Anything with a unit, target, and current reading. SLO is a KPI sub-kind with a tighter shape.

| Field | Type | Required | Notes |
|---|---|---|---|
| `unit` | string | yes | `percent` \| `ms` \| `score` \| `currency-eur` \| `count` |
| `target` | number \| null | optional | Floor or null when "track only" |
| `stretch` | number \| null | optional | Aspiration |
| `currentValue` | number \| null | optional | Last observed |
| `currentValueDate` | string \| null | optional | ISO date of `currentValue` |
| `dashboardUrl` | string | optional | Where to see live value (`_TBD_` until wired) |
| `source` | string | optional | Benchmark / standard the target traces back to |
| `ownerTeam` | string | yes | |
| `dri` | string | optional | Specific role |

### `kind: sla` — contractual service-level agreement

An SLO promoted to a contract. Carries counterparty, contract reference, penalties, reporting cadence.

| Field | Type | Required | Notes |
|---|---|---|---|
| `boundsSlo` | `Dependency[]` | optional | The SLO this SLA is the contractual side of |
| `boundsComponent` | `Dependency[]` | optional | Components / systems explicitly in scope |
| `counterparty` | string | yes | Customer / partner / regulator the SLA is owed to |
| `contractReference` | string | yes | Pointer to the contract / regulation |
| `penalties` | string | optional | Service credits / fines text |
| `reportingCadence` | enum | yes | `monthly` \| `quarterly` \| `annual` \| `incident-driven` |
| `regulatoryBasis` | string[] | optional | Standards / regulations |

### `kind: objective` — quarterly outcome statement

Append-only per-quarter entry. Wodtke 1+3 — typically one Objective per team per quarter.

| Field | Type | Required | Notes |
|---|---|---|---|
| `period` | string | yes | `q3-2026` (slug) |
| `tag` | enum | yes | `Committed` \| `Aspirational` |
| `status` | enum | optional | `pending` \| `in-progress` \| `met` \| `missed` \| `dropped` |
| `cascadesFrom` | string \| null | optional | Parent Objective name (cascade up — R&D → Team → squad) |
| `cascadesTo` | string[] | optional | Child Objectives |
| `tracks` | `Dependency[]` | yes | KeyResults this Objective tracks |

### `kind: keyResult` — measurable result for an Objective

| Field | Type | Required | Notes |
|---|---|---|---|
| `period` | string | yes | Same shape as Objective |
| `objective` | string | yes | Parent Objective name |
| `measuredBy` | `Dependency[]` | yes | KPI / SLO entries this KR is read off of |
| `successCondition` | string | yes | Plain English target — pass/fail rule |
| `deadline` | string | optional | ISO date for time-bound KRs |
| `tag` | enum | yes | `Committed` \| `Aspirational` |
| `status` | enum | optional | Same as Objective |

### `kind: dataAsset` — logical data store

Distinct from `kind: service` / `kind: infra`. A Service hosts DataAssets (MongoDB hosts `icc-mongo-alarms` and `icc-mongo-pugio`); a Component reads or writes the data.

| Field | Type | Required | Notes |
|---|---|---|---|
| `storedIn` | `Dependency[]` | yes | Service / infra entry that physically stores this data |
| `writtenBy` | `Dependency[]` | yes | Components that write to it |
| `readBy` | `Dependency[]` | optional | Components that read it (frequently long; often easier to derive from inverse stitching once Phase 6 lands) |
| `classifiedAs` | `Dependency[]` | yes | One or more `kind: classification` entries (`pii`, `life-safety`, `public`, …) |
| `retention` | string | optional | `30d` \| `1y` \| `indefinite` \| free-text legal-basis |
| `estimatedSize` | string | optional | `_TBD_` until cost discovery (Phase 5) populates |
| `knownIssues` | string[] | optional | Bullets surfaced in the drawer (e.g. "no DR", "untested backups") |

### `kind: classification` — data sensitivity tag

| Field | Type | Required | Notes |
|---|---|---|---|
| `severity` | enum | yes | `lowest` \| `low` \| `medium` \| `high` \| `highest` |
| `regulatoryBasis` | string[] | optional | Standards / regulations that drive the rules (`GDPR`, `EU DORA`, `EN 50134`, …) |
| `handlingRules` | string[] | yes | Bullet rules a DataAsset of this classification must satisfy |

### `kind: dataPipeline` — ETL / streaming pipeline

Use when a workflow moves data between two or more DataAssets. Stub-only for now.

| Field | Type | Required | Notes |
|---|---|---|---|
| `consumes` | `Dependency[]` | yes | Source DataAssets |
| `produces` | `Dependency[]` | yes | Sink DataAssets |
| `runsOn` | `Dependency[]` | optional | Component / infra hosting the pipeline |

### `kind: slo` — service-level objective

A KPI a team commits to internally. Tighter shape than a generic KPI: availability %, latency percentile, success rate, freshness — plus a rolling-window definition. SLAs (Phase 4) reference the SLO they're under contract for.

| Field | Type | Required | Notes |
|---|---|---|---|
| `sliType` | enum | yes | `availability` \| `latency-percentile` \| `success-rate` \| `error-rate` \| `freshness` \| `throughput` |
| `target` | number | yes | Floor — value the team is committed to (e.g. `99.9`) |
| `stretch` | number | optional | Aspiration — value the team is reaching for |
| `unit` | enum | yes | `percent` \| `ms` \| `seconds` \| `events-per-second` \| `count` |
| `window` | string | yes | Rolling window — `30d-rolling` \| `7d-rolling` \| `quarterly` |
| `errorBudgetMinPerMonth` | number | optional | Pre-computed minutes (helps the drawer show "21.6 min/month at 99.95%") |
| `ownerTeam` | string | yes | Team slug (`external` / `internal` / `iot-core` / `platform`) — references `kind: team` |
| `dri` | string | optional | Specific role responsible (`ICC TL`, `IoT Backend TL`, `EM`) |
| `governs` | `Dependency[]` | yes | Components / services / APIs this SLO measures (`{target, kind}` form) |
| `boundsSlaCandidate` | bool | optional | True when this SLO is reasonably going to be sold to a customer / regulator. Promotes to `kind: sla` (Phase 4) when contract exists |
| `currentStatus` | enum | optional | `pass` \| `fail` \| `unknown` — current standing for visibility (drives a red badge in the drawer) |
| `currentStatusReason` | string | optional | One-line why if `fail` |
| `source` | string | optional | Provenance — benchmark / standard / OKR doc the target traces back to |

### `kind: oncall` — paging / escalation policy

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerTeam` | string | yes | Team slug |
| `rotationModel` | enum | yes | `follow-the-sun` \| `weekly` \| `business-hours` \| `manual` |
| `scheduleSource` | string | optional | Where the live schedule lives (e.g. PagerDuty schedule URL). `_TBD_` until integration ships |
| `pages` | `Dependency[]` | yes | Components / services this rotation is paged for |

`annotations.pagerduty/policy-id`, `pagerduty/schedule-id`, `opsgenie/team-id` carry external-system identifiers without expanding the schema.

### `kind: runbook` — operational playbook

| Field | Type | Required | Notes |
|---|---|---|---|
| `documents` | `Dependency[]` | yes | Components / services the runbook applies to |

Body lives in `README.md`; `annotations.confluence/page-id` for upstream reference. The Brain stitcher surfaces runbooks on every component named in `documents[]` via the entity drawer.

### `kind: team` — R&D org unit

For the company R&D teams (External, Internal, IoT Core, Platform). Owns repos, services, products, systems. Until the Brain stitcher (Phase 6) derives ownership from `dependsOn` direction, repos still carry the historical `team` string field; team entries declare `repoTeamMatch[]` to bridge old strings → new entries.

| Field | Type | Required | Notes |
|---|---|---|---|
| `displayName` | string | yes | Human-readable label as used in OKR docs (`External (Spain + Sweden)`, `IoT Core (Luleå)`) |
| `locations` | string[] | yes | Office cities (`Madrid`, `Malmö`, `Vietnam`, `Luleå`, `Distributed`) |
| `costCentre` | string \| null | yes | R&D cost centre code or `null` if TBD |
| `costCentreNote` | string | optional | Used when `costCentre` is null to explain why |
| `headcount` | number | yes | Approximate seat count at `last-updated` |
| `leadership` | object | optional | `{model, members?: [{name, role}], notes?}` — Trio model is `EM + PO + TL`; `members[]` only when a full named roster makes sense (small new teams) |
| `northStar` | string | optional | One-sentence team-level outcome statement |
| `charter` | string | optional | Bias / way-of-working statement (Platform team uses this; product teams typically don't) |
| `pillars` | string[] | optional | Axes the team organises work around (Platform: `Security`/`DevEx`/`Data Platform`/`ICO Stabilisation`) |
| `ownsSystems` | string[] | yes | System manifest ids the team is responsible for |
| `repoTeamMatch` | string[] | yes | Historical free-text values found in `repo.team` that resolve to this team. Used by stitcher and grep until Phase 6 lands |

`system` field is always `cross-cutting`. `layer` is `business`.

#### Example

```json
{
  "name": "iot-core",
  "kind": "team",
  "description": "IoT Core team (Luleå) — embedded firmware + hardware engineering.",
  "system": "cross-cutting",
  "layer": "business",
  "displayName": "IoT Core (Luleå)",
  "locations": ["Luleå"],
  "costCentre": "1832",
  "headcount": 9,
  "leadership": {"model": "Trio (EM + PO + TL)"},
  "northStar": "Every device in the field, every day: trigger reliable, audio reliable, battery reliable, update reliable.",
  "ownsSystems": ["eliza", "embedded"],
  "repoTeamMatch": ["IoT Core (Luleå)"]
}
```

#### Example

```json
{
  "name": "abby",
  "kind": "product",
  "description": "GPS social alarm worn on the body",
  "system": "iot-backend",
  "layer": "device",
  "vendor": "the company",
  "category": "mobile-alarm",
  "lifecycle": "production",
  "image": "/products/abby.jpg",
  "marketing_url": "https://www.brain.com/se/trygghetslosningar/trygghetslarm/abby-gps-trygghetslarm/",
  "componentRepos": ["cp-example-460-service"],
  "communicatesWith": [
    {"target": "cp-example-460-service", "kind": "repo", "protocol": "TCP+TLS", "port": 61814, "purpose": "bracket-text alarm protocol"}
  ],
  "tags": ["mobile-alarm", "gps", "cellular"]
}
```

## System manifest (kind: system entries)

One folder per system: `catalog/systems/<id>/catalog-info.json`. Drives the C4 Level 1 system-context view.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Slug — must match `system` field used by member entries |
| `kind` | `"system"` | yes | Discriminator |
| `displayName` | string | yes | Human-readable system name |
| `description` | string | yes | One-paragraph description of what the system does |
| `layer` | enum | yes | Same enum as entries |
| `ownerTeam` | string | yes | Team that owns this system |
| `boundary` | string | yes | Physical/logical scope (e.g. `"Madrid / AWS EKS"`, `"Vietnam / On-premise"`) |
| `c4Kind` | enum | yes | `system` (internal) \| `external_system` (drawn outside the boundary) |
| `externalActors` | string[] | optional | Persona ids from `narratives/architecture/personas.json` |
| `entryPoints` | `{kind, protocol, port, purpose, exposedBy}[]` | optional | Public surface — how other systems / actors enter this system. `exposedBy` is the catalog entry name that hosts the entry point |

### Example system manifest

```json
{
  "id": "icc",
  "name": "i-care connect (ICC)",
  "description": "Centralised alarm hub. Receives alarms from devices and SCAIP agents, manages operator workflow via Gladius, routes to ARC responders, handles voice via Asterisk.",
  "layer": "domain",
  "owner_team": "External (Spain + Sweden)",
  "boundary": "Madrid / AWS EKS",
  "c4_kind": "system",
  "external_actors": ["arc-operator"],
  "entry_points": [
    {"kind": "ingress", "protocol": "HTTPS", "port": 443, "purpose": "Operator UI (Gladius)", "exposedBy": "cp-aurora-gladius"},
    {"kind": "ingress", "protocol": "GraphQL", "port": 7600, "purpose": "ICG mobile app gateway", "exposedBy": "cp-icc-caronte"},
    {"kind": "ingress", "protocol": "SIP/SCAIP", "port": 5060, "purpose": "Voice + text alarm intake", "exposedBy": "cp-aurora-xgateway"}
  ]
}
```

## Layers

Coarse architectural layers. Used for swimlane layout in graph and for filtering views.

| `layer` | Members | Examples |
|---|---|---|
| `device` | Physical devices and firmware | `dpd-A150-software-package`, Eliza peripherals, Abby, Amy, Doro 450 |
| `edge` | Protocol gateways / edge translators | `cp-aurora-xgateway`, `cp-aurora-scaip-agent`, `cp-example-460-service`, `cp-generic-iot-backend` (TCP listener side), ICO LwICO listener, `cp-icc-caronte` |
| `domain` | Domain backends — main business logic per system | `cp-aurora-backend`, `cp-generic-iot-backend`, `i-care-online`, `app-icare-plus`, `app-icare-go`, `cp-aurora-gladius`, `cp-aurora-pugio` |
| `platform` | Shared platform services used by multiple domains | `keycloak`, `cp-identities`, `cp-sendmessage-service`, `cp-alarm-routing-service`, `customers-service`, `csp-persons` |
| `data` | Datastores and message brokers | `mongodb`, `mariadb-keycloak`, `aws-rds-postgres`, `aws-aurora-serverless`, `aws-dynamodb`, `aws-elasticache`, `aws-sqs`, `aws-sns`, `artemis`, `gcp-firestore`, `on-premise-sql-server`, `redis-icc` |
| `cross-cutting` | Observability, CI/CD, dev tools, infra-as-code, monitoring | `grafana`, `loki`, `prometheus`, `sentry`, `datadog`, `cp-aurora-helm-charts`, `central-monitoring-service`, `weblate-ec2` |
| `business` | Business-domain non-architectural entries — capabilities, value streams, OKRs | `alarm-path`, `device-onboarding`, `q3-2026-platform-objective` |
| `r-and-d` | R&D org units — teams (engineering, embedded, mobile, ...) | `external`, `internal`, `iot-core`, `platform` |

Layer is independent of `system`. A repo can belong to system `icc` but live in `layer: edge` (e.g. xgateway).

## Folder layout

Flat-by-kind. One folder per kind at `catalog/<kind-plural>/`, one folder per entry inside.

```
catalog/
  repos/<name>/             # kind: repo — source-code repositories
  systems/<id>/             # kind: system — C4 L1 system manifests
  services/<name>/          # kind: service — deployed software with no own repo
  infra/<name>/             # kind: infra — cloud / managed services
  external/<name>/          # kind: external — third-party / partner systems
  products/<name>/          # kind: product — customer-facing physical/digital products
  teams/<slug>/             # kind: team — R&D org units
  apis/<name>/              # kind: api — producer + consumer-resolved API surfaces
  capabilities/<name>/
  classifications/<name>/
  data-assets/<name>/
  key-results/<id>/
  kpis/<id>/
  objectives/<id>/
  oncall/<rotation>/
  runbooks/<name>/
  slas/<name>/
  slos/<name>/
  value-streams/<name>/
```

Each `<name>/` folder contains `catalog-info.json` (typed) + `README.md` (prose) + optional `openapi.json`.

The `domain` and `system` fields inside `catalog-info.json` carry the company-specific bucketing; the folder path itself encodes only the kind.

## Validation rules

Brain CLI should enforce on import:

1. Every entry has `name`, `kind`, `description`, `system`, `layer`.
2. `name` matches the folder name.
3. `system` matches a `kind: system` entry id under `catalog/systems/`.
4. Every `dependsOn[].target` resolves to a catalog entry. Unresolved → warning (not error, allows author-time progress).
5. `dependsOn[].kind` matches the resolved target's `kind`.
6. `kind: service` entries have non-empty `deployedBy`.
7. `kind: infra` entries have `provider`, `service`, `managed`.
8. `kind: external` entries have `vendor`, `category`.
| Frontend `src/components/DetailDrawer.jsx` | Render new `Dependency` object shape |
| `narratives/architecture/connections.json` | Delete after enrichment migration |
| Brain Go `app/architecture.go` `GetAll()` file map | Remove `connections` entry |
| `brain/frontend/src/data/systems.jsx` | Drop dependency on `connections` field |

## Out of scope (this iteration)

- Per-instance infra entries (one `aws-rds` entry, not one per RDS instance)
- API surface graph (would need to elevate `providesApis`/`consumesApis` to first-class catalog nodes — defer)
- Time-versioned entries (catalog reflects current state)
