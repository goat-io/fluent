import type { TypesenseDocument, TypesenseCollectionOptions } from '../../typesense.model'
import { TypesenseError, isValidDocumentId } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

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