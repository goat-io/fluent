import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDocument
} from '../../typesense.model'
import { isValidDocumentId, TypesenseError } from '../../typesense.model'

export async function updateDocument<TDoc extends Record<string, any>>(
  ctx: TypesenseContext<TDoc>,
  document: Partial<TypesenseDocument<TDoc>> & { id: string | number },
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<TDoc>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('updateDocument requires a valid document id', 400)
  }

  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseDocument<TDoc>>(
    `/collections/${collectionName}/documents/${document.id}`,
    {
      method: 'PATCH',
      body: document
    }
  )
}
