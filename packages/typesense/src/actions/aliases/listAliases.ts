import type { TypesenseContext } from '../../types'
import type { TypesenseAliasListResponse } from '../../typesense.model'

export async function listAliases(
  ctx: TypesenseContext,
): Promise<TypesenseAliasListResponse> {
  return await ctx.httpClient.request<TypesenseAliasListResponse>('/aliases')
}
