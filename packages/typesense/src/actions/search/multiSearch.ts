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
  return await ctx.httpClient.request<TypesenseMultiSearchResult<T>>(
    '/multi_search',
    {
      method: 'POST',
      body: request,
    },
  )
}
