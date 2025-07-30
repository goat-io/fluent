import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseOverrideResponse
} from '../../typesense.model'

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
