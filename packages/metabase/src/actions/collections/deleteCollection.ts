import { metabaseFetch } from '../../common/fetch-wrapper'

export async function deleteCollection({
  baseUrl,
  sessionToken,
  apiKey,
  collectionId,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  collectionId: number
}): Promise<Response> {
  const response = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: `/api/collection/${collectionId}`,
    method: 'PUT',
    body: { archived: true },
  })

  if (!response.ok) {
    console.error(
      `❌ Failed to delete collection ${collectionId}:`,
      await response.text(),
    )
    throw new Error(`Failed to delete collection ${collectionId}`)
  }

  return response
}
