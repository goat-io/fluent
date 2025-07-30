import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDocument,
  WithRequiredId
} from '../../typesense.model'
import { isValidDocumentId, TypesenseError } from '../../typesense.model'
import { getOrCreateCollection } from '../collections/getOrCreateCollection'

export async function insertDocument<TDoc extends Record<string, any>>(
  ctx: TypesenseContext<TDoc>,
  document: WithRequiredId<TDoc>,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<TDoc>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('Document must have a valid id', 400)
  }

  const collectionName = options?.collection || ctx.fqcn()

  try {
    return await ctx.httpClient.request<TypesenseDocument<TDoc>>(
      `/collections/${collectionName}/documents`,
      {
        method: 'POST',
        body: document
      }
    )
  } catch (error: any) {
    // Auto-create collection if enabled
    if (
      ctx.autoCreateCollection &&
      (error.status === 404 || error.response?.status === 404)
    ) {
      // Infer schema from document
      const inferredSchema = ctx.schemaManager.inferSchemaFromDocument(
        document,
        collectionName
      )

      // Create collection
      await getOrCreateCollection(ctx, {
        ...inferredSchema,
        name: collectionName
      })

      // Retry insert
      return await ctx.httpClient.request<TypesenseDocument<TDoc>>(
        `/collections/${collectionName}/documents`,
        {
          method: 'POST',
          body: document
        }
      )
    }
    throw error
  }
}
