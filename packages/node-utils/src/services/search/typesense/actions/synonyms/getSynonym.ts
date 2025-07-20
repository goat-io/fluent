import type { TypesenseSynonymResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getSynonym(
  ctx: TypesenseContext,
  synonymId: string,
  options?: TypesenseCollectionOptions
): Promise<TypesenseSynonymResponse> {
  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseSynonymResponse>(
    `/collections/${collectionName}/synonyms/${synonymId}`
  )
}