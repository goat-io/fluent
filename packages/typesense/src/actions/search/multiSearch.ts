import type { TypesenseContext } from '../../types'
import type {
  TypesenseMultiSearchRequest,
  TypesenseMultiSearchResult,
} from '../../typesense.model'

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
