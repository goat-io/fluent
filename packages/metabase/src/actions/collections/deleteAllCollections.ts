import { metabaseFetch } from '../../common/fetch-wrapper'
import { deleteCollection } from './deleteCollection'

export async function deleteAllCollections({
  baseUrl,
  sessionToken,
  apiKey
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<void> {
  // Fetch existing collections
  const collectionsRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/collection',
    method: 'GET'
  })

  if (!collectionsRes.ok) {
    console.error(
      '❌ Failed to fetch collections:',
      await collectionsRes.text()
    )
    throw new Error(`Failed to fetch collections from ${baseUrl}`)
  }

  const collections = (await collectionsRes.json()) as Array<{
    name: string
    // The base Our analytics has Id 'root' which is not a number
    id: number | string
  }>

  for (const col of collections) {
    if (col.id !== 'root') {
      await deleteCollection({
        sessionToken,
        apiKey,
        baseUrl,
        collectionId: Number(col.id)
      })
    }
  }
}
