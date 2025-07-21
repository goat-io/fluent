import { metabaseFetch } from '../common/fetch-wrapper'

interface MetabaseDatabase {
  id: number
  name: string
  engine: string
}

interface MetabaseDatabaseListResponse {
  data: MetabaseDatabase[]
}

/**
 * Deletes the Metabase sample database if it exists
 * @param params - Authentication parameters
 * @returns void
 * @throws Error if deletion fails
 */
export async function deleteSampleDatabase({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<void> {
  const DATABASE_NAME = 'Sample Database'

  // Fetch existing databases
  const existingDatabasesRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/database',
    method: 'GET',
  })

  const existingDatabases =
    (await existingDatabasesRes.json()) as MetabaseDatabaseListResponse

  const sampleDb = existingDatabases.data.find(
    (db) => db.name === DATABASE_NAME,
  )

  if (!sampleDb) {
    return
  }

  // Delete the sample database
  try {
    await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: `/api/database/${sampleDb.id}`,
      method: 'DELETE',
    })
  } catch (error) {
    // Some Metabase versions may not allow deleting the sample database
    if (error instanceof Error && error.message.includes('403')) {
      // Sample database may be protected in some versions
    } else {
      throw error
    }
  }
}
