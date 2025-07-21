import { metabaseFetch } from '../../common/fetch-wrapper'
import { setCollectionPermissionsForGroup } from '../groups/setCollectionPermissionsForGroup'

interface MetabaseCollection {
  id: number
  name: string
  description?: string | null
  parent_id?: number | null
  namespace?: string | null
  authority_level?: string | null
  archived?: boolean
}

/**
 * Gets an existing collection by name or creates a new one
 * @param params - Collection parameters and authentication
 * @param restrictToGroupId - Optional group ID to restrict access to (if not provided, default Metabase permissions apply)
 * @returns Collection ID
 * @throws Error if collection creation fails
 */
export async function getOrCreateCollection({
  sessionToken,
  apiKey,
  collectionName,
  baseUrl,
  restrictToGroupId,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  collectionName: string
  restrictToGroupId?: number
}): Promise<number> {
  // Fetch existing collections
  const collectionsRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/collection',
    method: 'GET',
  })

  const collections = (await collectionsRes.json()) as MetabaseCollection[]

  // Find collection by name, excluding archived ones
  const existingCollection = collections.find(
    (col) => col.name === collectionName && !col.archived,
  )

  if (existingCollection) {
    // Even if collection exists, we need to update permissions if requested
    if (restrictToGroupId !== undefined) {
      try {
        await setCollectionPermissionsForGroup({
          baseUrl,
          sessionToken,
          apiKey,
          groupId: restrictToGroupId,
          collectionId: existingCollection.id,
          permission: 'write',
        })
      } catch (error) {
        console.warn(
          `⚠️  Failed to set group permissions for existing collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }
    return existingCollection.id
  }

  console.log(`🛠 Creating collection '${collectionName}'...`)

  // Create new collection
  const createRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/collection',
    method: 'POST',
    body: {
      name: collectionName,
      parent_id: null, // Root-level collection
      description: `Auto-generated collection for ${collectionName}`,
      namespace: null,
    },
  })

  const collectionData = (await createRes.json()) as MetabaseCollection

  // Set permissions for specific group if requested
  if (restrictToGroupId !== undefined) {
    try {
      await setCollectionPermissionsForGroup({
        baseUrl,
        sessionToken,
        apiKey,
        groupId: restrictToGroupId,
        collectionId: collectionData.id,
        permission: 'write',
      })
    } catch (error) {
      console.warn(
        `⚠️  Failed to set group permissions for collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      // Don't fail the entire operation if permissions can't be set
    }
  }

  return collectionData.id
}
