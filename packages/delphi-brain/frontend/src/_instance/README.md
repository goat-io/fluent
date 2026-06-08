# `_instance/` — the company-specific seam

Everything outside this directory is generic Brain frontend code that any company adopting Brain can use as-is. Everything **inside** this directory is the company-specific and is the explicit replacement point when Brain is forked for another company.

## What lives here

| Path | What it is | Why it's here |
|------|------------|---------------|
| `lib/domains.js` | `DOMAIN_CONFIG` colour map for the company domains (icc, ico, iot-backend, …) | Domain vocabulary varies per company. The generic `lib/badgeRegistry.js` re-exports from this file. |
| `views/PlatformPlanView.jsx` | Slide deck — Platform team's May 2026 plan | Hand-authored the company narrative |
| `views/ArchitectureWorkshopView.jsx` | Slide deck — 2026-05-07 architecture workshop | Hand-authored the company narrative |
| `views/UnderstandingOkrsView.jsx` | Slide deck — Product Owner OKR training | Hand-authored the company narrative |
| `views/AwsAnalysisView.jsx` | Slide deck — 30-account AWS audit findings | Hand-authored the company narrative |

## When extracting Brain to its own repo

1. Delete `_instance/` entirely.
2. Provide stub `lib/domains.js` exporting an empty `DOMAIN_CONFIG = {}` (the generic `badgeRegistry.js` falls back to grey for unknown domains, which is fine).
3. Remove the four slide-deck imports + routes from `App.jsx`. The remaining views (UnifiedView, DashboardView, DependencyGraph, modes/*) are generic.
4. Each consuming company adds back its own `_instance/` content in their own deployment.

## When adding new the company-specific UI

Drop it under `_instance/` rather than next to generic views. Keeps the seam visible and makes the eventual extraction mechanical.
