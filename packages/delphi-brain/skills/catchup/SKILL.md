---
name: catchup
description: "Agent onboarding — read key files to understand the company's business, architecture, and transformation goals."
when_to_use: "catchup", "onboard", "get up to speed", "understand the project", "what does example do"
argument-hint: "[quick|deep]"
allowed-tools: Read Glob Grep
---

# Catchup — Agent Onboarding Skill

Get up to speed on the company's business, architecture, and transformation goals. Read files in order by depth level. Stop at the level that matches your task.

## Usage

`/catchup` — full onboarding (all levels)
`/catchup quick` — Level 1 only (5 files, enough for most tasks)
`/catchup deep` — Levels 1–3 (architecture + transformation context)

## Reading Order

### Level 0 — Recent session handovers (always check first)

**First, if `AGENT_HANDOVER.md` exists in the repo root, read it.** It is the live local-session snapshot (gitignored, local-only — see the handover skill): the previous agent's current state, blockers with root-cause analysis, and what to do first. It is the freshest pointer and overrides stale assumptions. It will not exist on a fresh clone or a remote/CI run; that is expected — fall back to the dated handovers below.

Then scan `narratives/handovers/` for the most recent dated handover. Each session that materially extends the codebase (new tooling, new schemas, new corrections to Brain docs) leaves a `YYYY-MM-DD-<topic>.md` handover (the committed audit trail) with: what was built, where it lives, source-of-truth pointers, outstanding work, and gotchas. Reading the latest one prevents you from re-discovering the previous agent's work or violating decisions already made.

```bash
[ -f AGENT_HANDOVER.md ] && cat AGENT_HANDOVER.md   # live local snapshot (if present)
ls narratives/handovers/ | sort -r | head -3        # 3 most recent dated handovers (committed)
```

### Level 1 — What is the company? (start here, always)

Read these in order:

1. `narratives/company/mission.md` — Life-safety critical elderly care, scale, device portfolio
2. `narratives/company/glossary.md` — the company-specific terminology (ARC, ICC, ICO, SCAIP, etc.)
3. `narratives/product/user-personas.md` — Five user groups and what they need
4. `narratives/architecture/overview.md` — Current-state system landscape
5. `narratives/architecture/system-diagram.md` — Visual map of all systems

After Level 1 you know: what the company does, who it serves, and how the systems fit together.

### Level 2 — How does it work? (architecture depth)

6. `narratives/services/README.md` — Service index with maturity ratings
7. `narratives/architecture/dependencies.md` — What calls what
8. `narratives/architecture/communication-flows.md` — Protocols, ports, formats. The "Wire-format references (source of truth)" table at the bottom is the canonical pointer for every wire format
9. `narratives/architecture/business-flows.md` — End-to-end alarm flow, FOTA, operator workflows
10. `narratives/architecture/data-flows.md` — Where data lives, ownership, duplication
11. `narratives/architecture/tech-landscape.md` — Languages, frameworks, cloud, tech debt
12. `narratives/payloads/README.md` — Per-device wire-format trace docs index. Required reading for anyone touching adapters, simulators, or backend protocol code. Each per-device doc cites `repo/path/file:line` in production source for every byte

After Level 2 you know: how services communicate, where data flows, and what the tech stack looks like.

### Level 3 — Where are we going? (transformation)

12. `narratives/roadmap/README.md` — Transformation overview (proposed, not decided)
14. `narratives/roadmap/technical-initiatives.md` — Common infra, event-driven arch, unified broker
15. `narratives/roadmap/organisational-initiatives.md` — Cross-functional teams, operational excellence
16. `narratives/roadmap/target-architecture.md` — Desired end state and gap analysis
17. `narratives/roadmap/target-organisation.md` — Proposed team structure

After Level 3 you know: what we're building toward and why.

### Level 4 — Operational & business context

18. `narratives/company/org-chart.md` — Current team structure, locations, key-person dependencies
19. `narratives/apis/overview.md` — API landscape
20. `narratives/infrastructure/overview.md` — Hosting across AWS, GCP, on-premise
21. `narratives/security/overview.md` — Security posture by system
22. `narratives/operations/tools.md` — Engineering tools and SaaS stack
23. `narratives/operations/integrations.md` — External system integrations
24. `narratives/business/sales/overview.md` — B2B2C sales model
25. `narratives/business/finance/overview.md` — Revenue streams (hardware, SaaS, services)

### Level 5 — Deep dives (as needed)

Read these based on the specific domain you're working in:

- **ICC (alarm hub):** `catalog/systems/icc/README.md` includes maturity assessment + members. Filter `catalog/systems/icc/ (members) or catalog/repos/ filtered by system=icc`
- **ICO (device mgmt) — single source of truth:** `narratives/roadmap/ico-transformation-plan.md` (current state, EMQX wedge, Strangler decomposition, build/buy, BYOD vision). Also see `catalog/systems/ico/`
- **IoT Backend:** `catalog/systems/iot-backend/README.md` then browse `catalog/systems/iot-backend/`
- **Apps (ICP/ICG):** `catalog/systems/apps/README.md` then browse `catalog/systems/apps/`
- **Embedded (Eliza):** `catalog/systems/eliza/README.md` then browse `catalog/systems/embedded/`
- **Infrastructure:** browse `catalog/infra/`
- **Infra team plan:** `narratives/roadmap/platform/infra-team-action-plan.md`
- **All 171 repos:** `narratives/github-repos.md`

#### Wire formats / device protocols / EMQX adapter work

Required reading for any work on adapters, device simulators, backend protocol code, or BYOD onboarding:

- **`narratives/payloads/`** — per-device wire-format trace (Eliza, Eliza peripherals, Abby, Amy, Doro 450). Every byte cited to `repo/path/file:line` in production source. Open-question deep-dives in `narratives/payloads/answers/`
- **`narratives/architecture/communication-flows.md`** — "Wire-format references (source of truth)" table at the bottom maps each protocol → authoritative source code → trace doc

#### Canonical schema + device simulator (PoC)

- **`tools/poc/proto/example/v1/`** — canonical protobuf schema (12 files, BYOD-extensible). The 88-code `AlarmCode` enum matches `cp-example-460-service/src/core/objects.py:21-110` byte-for-byte so adapters map by numeric identity. Generates clients for Go/TS/Python/Java/C#/C++ via `tools/poc/proto/cmd/example-proto/` Go CLI
- **`tools/poc/simulator/`** — software simulator that mimics every connected the company device (Eliza A150, Abby, Amy, Doro 450, Enzo, 9200 platform peripherals, 9350 third-party adapter). Hexagonal layout: `domain/<device>/` is pure device behaviour, `ports/` declares the driven interfaces (UDP/TCP/TLS/SIP/HTTPS/SMS targets), `app/` is the use-case layer drivers call into, `adapters/driving/cli/` is the CLI binary, `adapters/driven/canonical/` translates wire frames to `example.v1.EventEnvelope`. Two strict guarantees: capabilities are physical (compile errors prevent impossible operations); wire fidelity is exact (every byte verified against production source via golden tests). Per-package AUDIT.md reports. SCAIP voice supports both SIP-INFO and RFC 2833 RTP DTMF. See `tools/poc/simulator/DESIGN.md`

## Key Facts to Internalize

After reading, you should know these non-obvious facts:

### Domain
- **ICC backend has NO REST API** — all communication is JMS/AMQP via Apache Artemis
- **Gladius → Pugio → Backend** uses Socket.IO → AMQP → JMS (not HTTP)
- **Caronte** is the HTTP gateway: GraphQL (for ICG) + REST (for Gladius) → AMQP → Backend
- **ICO evolved into the central data aggregator** — SQL Server with 78 tables, 457 stored procs
- **3 cloud providers**: AWS (ICC, IoT), GCP (Apps), On-premise (ICO)
- **Missed alarm = potential death** — this is life-safety critical infrastructure

### Device protocols (gotchas — verified 2026-05-04)
- **Eliza peripheral mesh is 868 MHz FSK, NOT BLE/Zigbee** — the BLE/Zigbee radios on Eliza S exist physically but are not used. Verified by firmware audit
- **Amy alarms bypass `cp-alarm-routing-service`** — they go direct to ICP via `IcpAlarmClient` inside `cp-generic-iot-backend`. The routing-service is only for 460/Abby + 450
- **Settings canonicalization is NOT in ICO** — lives in `cp-example-460-service/src/utils/hash.py:30-65` (Abby MD5) and `cp-generic-iot-backend/packages/lib/src/utils/hashAmy.ts:11-120` (Amy MD5). Doro 450 has no settings hash at all
- **460/450 timestamps use 15-min TZ units, format `±NND`** — NN = 15-min units, D = informational DST digit. So `+041` = UTC+01:00 with DST=1 (NOT UTC+04:10)
- **`cp-generic-iot-c-library` is a 2023 PoC misaligned with prod** — disagrees with production server on every message-type ID. DO NOT use as a reference. Server `cp-generic-iot-backend/apps/tcp-server/src/types.ts` is truth
- **The 88-code alarm catalog already exists** at `cp-example-460-service/src/core/objects.py:21-110` (`DeviceAlarmType`); the unified→SCAIP translator at the same file `:294-380` (`SCAIP_ALARM_TYPE_LOOKUP`) is the rosetta stone
- **`AlarmCode = 48` is overloaded**: Abby `PERIPHERAL_ALARM`, Amy `MAIN_ALARM_B_COHABITER`, Eliza SCAIP `dty=3 stc=10` (panic) — same numeric, three semantics

### Catalog v2 schema (live as of 2026-05-04)
- **Catalog has 4 entry kinds** — `repo`, `service`, `infra`, `external`. Not just repos. See [`brain/schema/CATALOG_SCHEMA.md`](../../../brain/schema/CATALOG_SCHEMA.md) for the full reference
- **`dependsOn` is an array of objects, NOT strings**. Each item is `{target, kind, protocol?, port?, purpose?, instance?}`. Old prefix convention (`infra:aws-eks`) is gone — `kind` is its own field
- **Every entry has `kind` + `layer`**. Layers: `device | edge | domain | platform | data | cross-cutting`
- **System manifests** live at `catalog/systems/<id>/catalog-info.json` — drive the C4 L1 view. 15 systems
- **`infrastructure/` folder contains repos AND `kind: service` AND `kind: infra` entries** — read `catalog-info.json` `kind` field to disambiguate. `external/` is its own top-level dir for `kind: external`
- **`narratives/architecture/connections.json` is gone** — edges are now derived from each catalog entry's `dependsOn`. Don't recreate it
- **Migration script** for legacy v1 (string deps) → v2: `tools/scripts/migrate-catalog-v2.py --dry-run` (idempotent)

### Brain & PoC web app
- Brain endpoint **`GET /api/architecture/systems`** returns the C4 L1 system-context aggregation (system manifests joined with members + cross-system edges)
- The PoC web app's **Systems tab** is the canonical "what systems do we have" view — derived from catalog. Catalog tab is the inventory view with filters (Kind / Layer / System / Domain / Type / Team)
- **Services tab was removed** — was hand-curated and drift-prone. Use Systems + Catalog instead. Some hand-curated narrative tabs (Business / Target State / PoC) remain

## After Reading

Do NOT summarize what you read. Just respond with:

> Ok, I'm ready to work.

The user already knows the content. Summaries waste tokens.

## Authoring your own handover at end of session

If your session materially extends the codebase — new tooling, new schemas, Brain corrections, multi-step refactors — leave a handover so the next agent doesn't redo or undo your work.

**Where:** `narratives/handovers/YYYY-MM-DD-<short-topic>.md`

**Required frontmatter:** `name`, `description`, `last-updated`, `owner`, `status`

**Required sections** (at minimum):
1. **What this session delivered** — bullets, with file/dir paths
2. **Source-of-truth map** — for any wire format / spec / canonical reference, link to the production source code file:line that proves it
3. **Outstanding work / next-session suggestions** — ordered by impact
4. **Verification** — exact commands the next agent runs to confirm nothing is broken
5. **Files modified or created** — full list
6. **Gotchas / non-obvious facts** — things that would mislead a fresh agent who only read the code

Reference example: [`narratives/handovers/2026-05-04-platform-protocol-work.md`](../../../narratives/handovers/2026-05-04-platform-protocol-work.md)
