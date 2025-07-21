import type { TypesenseAliasListResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listAliases(
  ctx: TypesenseContext
): Promise<TypesenseAliasListResponse> {
  return await ctx.httpClient.request<TypesenseAliasListResponse>('/aliases')
}