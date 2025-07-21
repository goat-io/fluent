import type { TypesenseDocument, TypesenseCollectionOptions, WithRequiredId } from '../../typesense.model'
import { TypesenseError, isValidDocumentId } from '../../typesense.model'
import type { TypesenseContext } from '../../types'
import { getOrCreateCollection } from '../collections/getOrCreateCollection'

export async function insertDocument<T extends Record<string, any>>(
  ctx: TypesenseContext,
  document: WithRequiredId<T>,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<T>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('Document must have a valid id', 400)
  }

  const collectionName = options?.collection || ctx.fqcn()

  try {
    return await ctx.httpClient.request<TypesenseDocument<T>>(
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
      error.status === 404 &&
      error.message?.includes('Not found')
    ) {
      // Infer schema from document
      const inferredSchema = ctx.schemaManager.inferSchemaFromDocument(document, collectionName)
      
      // Create collection
      await getOrCreateCollection(ctx, {
        ...inferredSchema,
        name: collectionName
      })
      
      // Retry insert
      return await ctx.httpClient.request<TypesenseDocument<T>>(
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