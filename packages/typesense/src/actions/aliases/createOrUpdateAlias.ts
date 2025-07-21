import type { TypesenseAliasResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function createOrUpdateAlias(
  ctx: TypesenseContext,
  aliasName: string,
  collectionName: string
): Promise<TypesenseAliasResponse> {
  return await ctx.httpClient.request<TypesenseAliasResponse>(
    `/aliases/${aliasName}`,
    {
      method: 'PUT',
      body: { collection_name: collectionName }
    }
  )
}