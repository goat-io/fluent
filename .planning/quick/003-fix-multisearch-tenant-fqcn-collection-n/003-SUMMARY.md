---
phase: quick-003
plan: 01
subsystem: typesense
tags: [typesense, multitenancy, fqcn, multisearch, bugfix]
depends_on: []
provides:
  - FQCN transformation for multiSearch collection names
  - Integration test for multiSearch tenant isolation
affects:
  - Any consumer using search.multi() with multitenancy enabled
tech_stack:
  added: []
  patterns:
    - FQCN transformation applied at action layer before HTTP request
key_files:
  created: []
  modified:
    - packages/typesense/src/actions/search/multiSearch.ts
    - packages/typesense/src/tests/typesense.api.test.ts
decisions:
  - Used ctx.fqcn(search.collection) which handles all cases: tenant+collection, tenant+undefined (default), no-tenant (passthrough)
  - Used error.status || error.response?.status for robust 409 conflict detection in tests (ky HTTPError puts status on response object)
metrics:
  duration: 249s
  completed: 2026-01-30
---

# Quick Task 003: Fix multiSearch Tenant FQCN Collection Names

**One-liner:** Apply ctx.fqcn() transformation to collection names in multiSearch request body before sending to Typesense API

## Objective

Fix `multiSearch` (`search.multi`) to apply tenant FQCN (Fully Qualified Collection Name) transformation to collection names in the request body. Previously, multiSearch sent raw collection names (e.g., `'products'`) instead of tenant-prefixed names (e.g., `'acme-corp__products'`). Single-collection operations already used `ctx.fqcn()` correctly; multiSearch did not.

## Changes Made

### Task 1: Apply FQCN transformation in multiSearch action
**Commit:** `cc884b4`
**File:** `packages/typesense/src/actions/search/multiSearch.ts`

Added a transformation step before the HTTP request that maps over `request.searches` and applies `ctx.fqcn(search.collection)` to each entry. The `ctx.fqcn()` function handles all cases:
- `ctx.fqcn('products')` with tenantId `'acme'` returns `'acme__products'`
- `ctx.fqcn('products')` without tenantId returns `'products'` (backward compatible)
- `ctx.fqcn(undefined)` falls back to the default `ctx.collectionName` with tenant prefix

### Task 2: Add integration test for multiSearch with tenant FQCN
**Commit:** `7a99959`
**File:** `packages/typesense/src/tests/typesense.api.test.ts`

Added test in `Multitenancy Support > Tenant Isolation` block that:
1. Creates a products collection via tenant1Api (acme-corp tenant)
2. Upserts a document
3. Calls `search.multi()` with raw collection name `'products'`
4. Verifies results are returned (proving FQCN was applied -- without it, Typesense would 404 on the non-existent raw collection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 409 conflict detection in test**
- **Found during:** Task 2
- **Issue:** ky's HTTPError exposes status on `error.response.status`, not `error.status` directly. The initial test used `error.status !== 409` which evaluated to `undefined !== 409`, causing the 409 to be re-thrown instead of caught.
- **Fix:** Changed to `const status = error.status || error.response?.status` for robust status detection.
- **Files modified:** `packages/typesense/src/tests/typesense.api.test.ts`
- **Commit:** included in `7a99959`

**2. [Rule 3 - Blocking] Fixed biome lint style violation**
- **Found during:** Task 2
- **Issue:** Biome enforces `useBlockStatements` -- inline `if (x) throw error` requires braces.
- **Fix:** Wrapped the throw statement in a block `if (x) { throw error }`.
- **Files modified:** `packages/typesense/src/tests/typesense.api.test.ts`
- **Commit:** included in `7a99959`

## Verification

- `npx tsc --noEmit` -- passes with zero errors
- `npx biome check .` -- passes with zero errors
- `pnpm test` -- 169/169 tests pass (168 existing + 1 new)
- New test "should apply FQCN to collection names in multiSearch" passes in 14ms

## Test Results

```
Test Files  6 passed (6)
     Tests  169 passed (169)
  Duration  15.11s
```
