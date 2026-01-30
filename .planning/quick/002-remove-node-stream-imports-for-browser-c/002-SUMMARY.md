---
phase: quick
plan: 002
subsystem: api
tags: [typesense, web-streams, readablestream, transformstream, browser-compat, react-native, expo]

# Dependency graph
requires: []
provides:
  - "Browser-compatible @goatlab/typesense with zero node: prefixed imports in production source"
  - "Web Streams API (ReadableStream, TransformStream) in public API surface"
  - "importDocuments accepts string | array | ReadableStream"
  - "exportDocumentsStream returns ReadableStream"
  - "ExportFormatter uses TransformStream for streaming transforms and parsers"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Web Streams API (ReadableStream/TransformStream) instead of Node streams"
    - "Concurrent read/write pattern for TransformStream tests to avoid backpressure deadlock"

key-files:
  modified:
    - "packages/typesense/src/actions/documents/exportDocuments.ts"
    - "packages/typesense/src/actions/documents/importDocuments.ts"
    - "packages/typesense/src/components/export-formatter.ts"
    - "packages/typesense/src/tests/export-formatter.test.ts"
    - "packages/typesense/src/tests/typesense.api.test.ts"

key-decisions:
  - "Use Web Streams API globals (ReadableStream, TransformStream) -- no imports needed, available in Node 18+, browsers, React Native, Expo"
  - "Replace Readable.from([string]) with plain string body -- ky HTTP client accepts strings natively"
  - "createGzipStream throws instead of silently breaking -- no universal browser gzip API"
  - "streamToString uses TextDecoder for proper chunked decoding"
  - "TransformStream tests use concurrent read/write pattern to prevent backpressure deadlock"

patterns-established:
  - "Web Streams API concurrent read/write: start reader promise before writer.write() to avoid TransformStream backpressure deadlock"

# Metrics
duration: 6min
completed: 2026-01-30
---

# Quick Task 002: Remove Node Stream Imports for Browser Compatibility

**Replaced all node:stream and node:zlib imports with Web Streams API (ReadableStream, TransformStream) for browser, React Native, and Expo compatibility**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-30T13:14:08Z
- **Completed:** 2026-01-30T13:19:59Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments
- Zero `node:stream` or `node:zlib` imports in any production source file
- Public API uses web-standard types: `ReadableStream` and `TransformStream`
- All 18 export-formatter tests pass with Web Streams API
- Package builds cleanly and type-checks without errors
- Library can now be imported in browser/React Native/Expo bundlers without node: polyfill errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Node streams in importDocuments.ts and exportDocuments.ts** - `cd57440` (feat)
2. **Task 2: Replace Node streams and zlib in export-formatter.ts** - `241663e` (feat)
3. **Task 3: Update tests to use Web Streams API** - `82cdc58` (test)
4. **Task 4: Final verification** - verification only, no commit needed

## Files Created/Modified
- `packages/typesense/src/actions/documents/exportDocuments.ts` - Removed Readable import, returns ReadableStream directly from httpClient.stream()
- `packages/typesense/src/actions/documents/importDocuments.ts` - Accepts ReadableStream, passes string body directly to ky (no Readable.from wrapping)
- `packages/typesense/src/components/export-formatter.ts` - Full rewrite: TransformStream for CSV/JSONL/parsers, ReadableStream for document stream and utilities, createGzipStream throws clear error
- `packages/typesense/src/tests/export-formatter.test.ts` - All stream tests use Web Streams API with concurrent read/write pattern
- `packages/typesense/src/tests/typesense.api.test.ts` - Stream import/export tests use ReadableStream + TextEncoder/TextDecoder

## Decisions Made
- **Web Streams API globals:** Used `ReadableStream` and `TransformStream` as globals (no import needed) since they are available in Node 18+, browsers, React Native, and Expo
- **Plain string body for imports:** Replaced `Readable.from([string])` with direct string assignment since ky's `requestTextWithRawBody` accepts strings natively
- **createGzipStream throws:** Changed from returning `createGzip()` to throwing with a clear error message about browser incompatibility, to avoid silent breakage
- **TextDecoder for streamToString:** Uses `TextDecoder` with `{ stream: true }` option for proper chunked byte-to-string conversion
- **Concurrent read/write in tests:** TransformStream has backpressure with default high-water mark of 1; reading must start before writing to avoid deadlock

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TransformStream backpressure deadlock in tests**
- **Found during:** Task 3 (Update tests to use Web Streams API)
- **Issue:** Tests timed out because writing to TransformStream writer blocked waiting for the reader to drain, but the reader loop only started after all writes completed -- classic deadlock
- **Fix:** Changed test pattern to start the read collection promise before writing, then await the results after writer.close()
- **Files modified:** `packages/typesense/src/tests/export-formatter.test.ts`
- **Verification:** All 18 tests pass in under 20ms total
- **Committed in:** `82cdc58` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct test operation with Web Streams API. No scope creep.

## Issues Encountered
- TransformStream backpressure deadlock in initial test implementation -- resolved by starting reader concurrently with writer (see Deviations above)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The @goatlab/typesense package is now fully browser-compatible
- The only remaining `node:` imports are in `tests/const.ts` (node:fs and node:path for test infrastructure), which is never bundled
- The package can be safely imported in any JavaScript environment without polyfills

---
*Quick Task: 002*
*Completed: 2026-01-30*
