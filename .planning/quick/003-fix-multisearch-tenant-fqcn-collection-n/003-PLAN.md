---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/typesense/src/actions/search/multiSearch.ts
  - packages/typesense/src/tests/typesense.api.test.ts
autonomous: true

must_haves:
  truths:
    - "multiSearch applies FQCN to collection names in each search entry when tenantId is configured"
    - "multiSearch passes collection names unmodified when no tenantId is configured"
    - "multiSearch handles search entries without a collection field (falls back to ctx.fqcn() default)"
  artifacts:
    - path: "packages/typesense/src/actions/search/multiSearch.ts"
      provides: "FQCN transformation of collection names in multi_search request body"
      contains: "ctx.fqcn"
    - path: "packages/typesense/src/tests/typesense.api.test.ts"
      provides: "Integration test for multiSearch with tenant FQCN"
      contains: "multi"
  key_links:
    - from: "packages/typesense/src/actions/search/multiSearch.ts"
      to: "ctx.fqcn()"
      via: "map over request.searches to transform collection field"
      pattern: "ctx\\.fqcn\\(.*collection"
---

<objective>
Fix multiSearch (search.multi) to apply tenant FQCN transformation to collection names in the request body before sending to the Typesense multi_search endpoint.

Purpose: Currently, multiSearch passes raw collection names (e.g., 'accounts') in the request body searches array. When tenantId is configured (e.g., 'acme'), the Typesense server expects tenant-prefixed collection names (e.g., 'acme__accounts'). Single-collection operations already use ctx.fqcn() correctly; multiSearch does not.

Output: Patched multiSearch action + integration test confirming FQCN is applied.
</objective>

<execution_context>
@/Users/igca/.claude/get-shit-done/workflows/execute-plan.md
@/Users/igca/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/typesense/src/actions/search/multiSearch.ts
@packages/typesense/src/actions/search/search.ts
@packages/typesense/src/utils/tenant.ts
@packages/typesense/src/types.ts
@packages/typesense/src/TypesenseApi.ts
@packages/typesense/src/typesense.model.ts
@packages/typesense/src/tests/typesense.api.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply FQCN transformation in multiSearch action</name>
  <files>packages/typesense/src/actions/search/multiSearch.ts</files>
  <action>
Modify the `multiSearch` function to transform collection names in each search entry using `ctx.fqcn()` before sending to the Typesense API.

The fix: Before making the HTTP request, map over `request.searches` and for each entry that has a `collection` field, replace it with `ctx.fqcn(entry.collection)`. If an entry does NOT have a `collection` field, add `collection: ctx.fqcn()` (which defaults to the context's collectionName with tenant prefix).

Implementation:

```typescript
export async function multiSearch<
  T extends Record<string, any> = Record<string, any>,
>(
  ctx: TypesenseContext,
  request: TypesenseMultiSearchRequest,
): Promise<TypesenseMultiSearchResult<T>> {
  // Apply FQCN transformation to collection names in each search entry
  const transformedRequest: TypesenseMultiSearchRequest = {
    searches: request.searches.map(search => ({
      ...search,
      collection: ctx.fqcn(search.collection),
    })),
  }

  return await ctx.httpClient.request<TypesenseMultiSearchResult<T>>(
    '/multi_search',
    {
      method: 'POST',
      body: transformedRequest,
    },
  )
}
```

Key behaviors:
- `ctx.fqcn(search.collection)` when collection is provided: returns `tenantId__collection` if tenantId is set, otherwise returns the collection name as-is
- `ctx.fqcn(undefined)` when collection is missing: returns `tenantId__defaultCollectionName` if tenantId is set, otherwise returns the default collection name
- This matches how single-collection search works: `const collectionName = options?.collection || ctx.fqcn()`

Do NOT change the function signature or the TypesenseMultiSearchRequest/TypesenseMultiSearchQuery types. The transformation happens purely at the action layer, same as all other actions.
  </action>
  <verify>
Run `cd packages/typesense && npx tsc --noEmit` to confirm no type errors.
Read the file to confirm ctx.fqcn() is called on each search entry's collection field.
  </verify>
  <done>
multiSearch maps over request.searches and applies ctx.fqcn() to each entry's collection field before sending the request. The function still passes type checks.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add integration test for multiSearch with tenant FQCN</name>
  <files>packages/typesense/src/tests/typesense.api.test.ts</files>
  <action>
Add a new test inside the existing `describe('Multitenancy Support', ...)` > `describe('Tenant Isolation', ...)` block (after the existing tenant isolation tests, around line 2070). The test should verify that `search.multi()` correctly applies FQCN when tenantId is configured.

Add this test at the end of the 'Tenant Isolation' describe block (before the closing `})`):

```typescript
it('should apply FQCN to collection names in multiSearch', async () => {
  // Ensure tenant1 has a products collection with a document
  const productSchema: TypesenseCollection = {
    name: 'products',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'price', type: 'float' },
    ],
  }

  try {
    await tenant1Api.collections.create(productSchema)
  } catch (error: any) {
    if (error.status !== 409) throw error
  }

  await tenant1Api.documents.upsert({
    id: 'ms-1',
    name: 'Multi Search Widget',
    price: 29.99,
  } as any)

  // Use search.multi with raw collection name - should be FQCN transformed
  const result = await tenant1Api.search.multi({
    searches: [
      {
        collection: 'products',
        q: 'Widget',
        query_by: 'name',
      },
    ],
  })

  expect(result).toBeDefined()
  expect(result.results).toBeDefined()
  expect(result.results.length).toBe(1)
  expect(result.results[0].found).toBeGreaterThanOrEqual(1)
})
```

Also add the `TypesenseMultiSearchRequest` import if not already present. Check the existing imports at the top of the file (around line 14-18) and add it to the import block from `'../typesense.model'` if missing.

Note: `getSlugByDomain` and `getMainPageBySlug` are NOT in this library (confirmed by grep - zero matches). They are consumer code. No changes needed for them.
  </action>
  <verify>
Run the full typesense test suite: `cd packages/typesense && npx vitest run src/tests/typesense.api.test.ts` (requires a running Typesense instance via docker).

If no Typesense instance is available, at minimum verify:
1. `cd packages/typesense && npx tsc --noEmit` passes (type check)
2. The test is syntactically correct and placed in the right describe block
  </verify>
  <done>
Integration test exists that creates a tenant API, inserts a document, then calls search.multi with a raw collection name and verifies results are returned (proving FQCN was applied, since without it Typesense would return 404 for the non-existent raw collection name).
  </done>
</task>

</tasks>

<verification>
1. `cd packages/typesense && npx tsc --noEmit` -- no type errors
2. Inspect multiSearch.ts -- confirms ctx.fqcn() is applied to each search entry's collection field
3. Inspect typesense.api.test.ts -- confirms multiSearch tenant test exists in the Multitenancy Support section
4. If Typesense docker is running: `cd packages/typesense && npx vitest run src/tests/typesense.api.test.ts` -- all tests pass including the new multiSearch tenant test
</verification>

<success_criteria>
- multiSearch applies ctx.fqcn() to every search entry's collection field before sending to Typesense
- When tenantId is set and collection is 'products', the request sends 'tenantId__products'
- When no tenantId is set, collection names pass through unchanged (backward compatible)
- When no collection is provided in a search entry, ctx.fqcn() falls back to the default collection name
- New integration test validates the fix
- All existing tests continue to pass (type check at minimum)
</success_criteria>

<output>
After completion, create `.planning/quick/003-fix-multisearch-tenant-fqcn-collection-n/003-SUMMARY.md`
</output>
