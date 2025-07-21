import type { TypesenseOverrideResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function deleteOverride(
  ctx: TypesenseContext,
  overrideId: string,
  options?: TypesenseCollectionOptions
): Promise<TypesenseOverrideResponse> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseOverrideResponse>(
    `/collections/${collectionName}/overrides/${overrideId}`,
    { method: 'DELETE' }
  )
}