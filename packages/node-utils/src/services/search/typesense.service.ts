import { Http } from '@goatlab/js-utils'
import type { KyInstance } from '@goatlab/js-utils'
import type {
  TypesenseCollection,
  TypesenseCollectionOutput,
  TypesenseDocument,
  TypesenseQuery,
  TypesenseQueryResults
} from './typesense.model'

export class TypesenseService<T> {
  private typesenseAPI: KyInstance
  private readonly collectionName: string

  constructor({
    prefixUrl,
    token,
    collectionName
  }: {
    prefixUrl: string
    token: string
    collectionName: string
  }) {
    this.collectionName = collectionName

    this.typesenseAPI = Http.getClient({
      prefixUrl,
      timeout: 10_000,
      retry: {
        limit: 5
      },
      headers: {
        'X-TYPESENSE-API-KEY': token
      }
    })
  }

  async createCollection(
    collection: TypesenseCollection
  ): Promise<TypesenseCollectionOutput> {
    return await this.typesenseAPI
      .post('collections', {
        json: collection
      })
      .json<TypesenseCollectionOutput>()
  }

  async deleteCollection(
    collection: TypesenseCollection
  ): Promise<TypesenseCollectionOutput> {
    return await this.typesenseAPI
      .delete(`collections/${collection.name}`)
      .json<TypesenseCollectionOutput>()
  }

  async updateCollection(
    collection: TypesenseCollection
  ): Promise<TypesenseCollectionOutput> {
    const noIdFields = collection.fields.filter(f => f.name === 'domains')

    return await this.typesenseAPI
      .patch(`collections/${collection.name}`, {
        json: {
          fields: noIdFields
        }
      })
      .json<TypesenseCollectionOutput>()
  }

  async insertDocument(
    document: TypesenseDocument<T>
  ): Promise<TypesenseDocument<T>> {
    return await this.typesenseAPI
      .post(`collections/${this.collectionName}/documents`, {
        json: document
      })
      .json<TypesenseDocument<T>>()
  }

  async upsertDocument(
    document: Partial<TypesenseDocument<T>>
  ): Promise<TypesenseDocument<T>> {
    return await this.typesenseAPI
      .post(`collections/${this.collectionName}/documents?action=upsert`, {
        json: document
      })
      .json<TypesenseDocument<T>>()
  }

  async updateDocument(
    document: Partial<TypesenseDocument<T>>
  ): Promise<TypesenseDocument<T>> {
    return await this.typesenseAPI
      .patch(`collections/${this.collectionName}/documents/${document.id}`, {
        json: document
      })
      .json<TypesenseDocument<T>>()
  }

  async deleteDocument(id: string | number): Promise<TypesenseDocument<T>> {
    return await this.typesenseAPI
      .delete(`collections/${this.collectionName}/documents/${id}`)
      .json<TypesenseDocument<T>>()
  }

  async getDocumentById(id: string | number): Promise<TypesenseDocument<T>> {
    return await this.typesenseAPI
      .get(`collections/${this.collectionName}/documents/${id}`)
      .json<TypesenseDocument<T>>()
  }

  async search(query: TypesenseQuery): Promise<TypesenseQueryResults<T>> {
    return await this.typesenseAPI
      .get(`collections/${this.collectionName}/documents/search`, {
        searchParams: {
          ...query
        }
      })
      .json<TypesenseQueryResults<T>>()
  }
}
