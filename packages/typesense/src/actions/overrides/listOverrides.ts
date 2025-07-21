import type { TypesenseOverrideResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listOverrides(
  ctx: TypesenseContext,
  options?: TypesenseCollectionOptions
): Promise<{ overrides: TypesenseOverrideResponse[] }> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<{ overrides: TypesenseOverrideResponse[] }>(
    `/collections/${collectionName}/overrides`
  )
}