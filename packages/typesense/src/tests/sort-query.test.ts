// Run from packages/typesense: pnpm test:types && pnpm exec vitest run src/tests/sort-query.test.ts
import { expect, test } from 'vitest'
import type { TypesenseQuery } from '../index.js'

test('public search query accepts multi-field sorting', () => {
  const query = {
    q: '*',
    query_by: 'title,summary',
    sort_by: 'publishedAt:desc,createdAt:desc,sortId:desc',
  } satisfies TypesenseQuery

  expect(query.sort_by).toBe('publishedAt:desc,createdAt:desc,sortId:desc')
})
