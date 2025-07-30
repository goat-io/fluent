import { metabaseFetch } from '../common/fetch-wrapper'

/**
 * Enables static embedding feature in Metabase
 * Required for embedding dashboards and questions in external applications
 * @param params - Authentication parameters
 * @throws Error if enabling embeddings fails
 */
export async function enableEmbeddings({
  baseUrl,
  sessionToken,
  apiKey
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}) {
  await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/setting/enable-embedding-static',
    method: 'PUT',
    body: { value: true }
  })
}
