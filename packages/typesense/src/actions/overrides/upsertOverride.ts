import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseOverride,
  TypesenseOverrideResponse,
} from '../../typesense.model'

export async function upsertOverride(
  ctx: TypesenseContext,
  override: TypesenseOverride,
  options?: TypesenseCollectionOptions,
): Promise<TypesenseOverrideResponse> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseOverrideResponse>(
    `/collections/${collectionName}/overrides/${override.id}`,
    {
      method: 'PUT',
      body: override,
    },
  )
}
