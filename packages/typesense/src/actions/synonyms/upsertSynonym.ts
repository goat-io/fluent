import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseSynonym,
  TypesenseSynonymResponse,
} from '../../typesense.model'

export async function upsertSynonym(
  ctx: TypesenseContext,
  synonym: TypesenseSynonym,
  options?: TypesenseCollectionOptions,
): Promise<TypesenseSynonymResponse> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseSynonymResponse>(
    `/collections/${collectionName}/synonyms/${synonym.id}`,
    {
      method: 'PUT',
      body: synonym,
    },
  )
}
