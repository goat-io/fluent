import type { TypesenseOverride, TypesenseOverrideResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function upsertOverride(
  ctx: TypesenseContext,
  override: TypesenseOverride,
  options?: TypesenseCollectionOptions
): Promise<TypesenseOverrideResponse> {
  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseOverrideResponse>(
    `/collections/${collectionName}/overrides/${override.id}`,
    {
      method: 'PUT',
      body: override
    }
  )
}