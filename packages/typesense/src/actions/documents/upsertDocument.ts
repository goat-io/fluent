import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDocument,
  WithRequiredId
} from '../../typesense.model'
import { isValidDocumentId, TypesenseError } from '../../typesense.model'

export async function upsertDocument<TDoc extends Record<string, any>>(
  ctx: TypesenseContext<TDoc>,
  document: WithRequiredId<TDoc>,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<TDoc>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('Document must have a valid id', 400)
  }

  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseDocument<TDoc>>(
    `/collections/${collectionName}/documents`,
    {
      method: 'POST',
      body: document,
      searchParams: { action: 'upsert' }
    }
  )
}
