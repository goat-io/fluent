import type { TypesenseSynonym, TypesenseSynonymResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function upsertSynonym(
  ctx: TypesenseContext,
  synonym: TypesenseSynonym,
  options?: TypesenseCollectionOptions
): Promise<TypesenseSynonymResponse> {
  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseSynonymResponse>(
    `/collections/${collectionName}/synonyms/${synonym.id}`,
    {
      method: 'PUT',
      body: synonym
    }
  )
}