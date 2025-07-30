import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Sets collection permissions for a specific group and collection.
 * This is useful after creating a new collection to ensure only the intended group has access.
 *
 * @param groupId - The ID of the group to grant permissions to
 * @param collectionId - The ID of the collection (or 'root' for the root collection)
 * @param permission - The permission level ('write', 'read', or 'none')
 */
export async function setCollectionPermissionsForGroup({
  baseUrl,
  sessionToken,
  apiKey,
  groupId,
  collectionId,
  permission = 'write'
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupId: number
  collectionId: number | 'root'
  permission?: 'write' | 'read' | 'none'
}): Promise<void> {
  try {
    // Get current collection permissions
    const permissionsResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/collection/graph?skip-graph=true',
      method: 'GET'
    })

    if (!permissionsResponse.ok) {
      const errorText = await permissionsResponse.text()
      throw new Error(
        `Failed to fetch collection permissions graph: ${errorText}`
      )
    }

    const permissionsGraph = await permissionsResponse.json()

    // Create a deep copy of the permissions graph
    const updatedGraph = JSON.parse(JSON.stringify(permissionsGraph))

    // Ensure the groups object exists
    if (!updatedGraph.groups) {
      updatedGraph.groups = {}
    }

    // Update permissions for all groups
    Object.keys(updatedGraph.groups).forEach(gId => {
      const groupIdNum = Number.parseInt(gId, 10)

      // Ensure group object exists
      if (!updatedGraph.groups[gId]) {
        updatedGraph.groups[gId] = {}
      }

      // Handle different group cases
      if (groupIdNum === groupId) {
        // Grant specified permission to the target group
        updatedGraph.groups[gId][collectionId] = permission
      } else if (groupIdNum === 1) {
        // For "All Users" group (ID: 1), set to 'none' to restrict access
        updatedGraph.groups[gId][collectionId] = 'none'
      } else if (groupIdNum !== 2) {
        // For all other groups (except administrators which is ID 2)
        // Set to 'none' to restrict access
        updatedGraph.groups[gId][collectionId] = 'none'
      }
      // Note: We don't modify administrators (group ID 2) permissions
    })

    // Include revision if it exists
    const payload = {
      groups: updatedGraph.groups,
      revision: updatedGraph.revision || 0
    }

    // Update the permissions
    const updateResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/collection/graph',
      method: 'PUT',
      body: payload
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update collection permissions: ${errorText}`)
    }

    const _result = await updateResponse.json()
  } catch (error) {
    console.error(`❌ Error setting collection permissions:`, error)
    throw error
  }
}
