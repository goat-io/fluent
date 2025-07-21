import type { TypesenseAliasResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getAlias(
  ctx: TypesenseContext,
  aliasName: string
): Promise<TypesenseAliasResponse> {
  return await ctx.httpClient.request<TypesenseAliasResponse>(
    `/aliases/${aliasName}`
  )
}