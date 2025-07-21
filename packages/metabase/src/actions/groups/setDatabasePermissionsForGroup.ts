import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Sets database permissions for a specific group and database.
 * This is useful after creating a new database to ensure only the intended group has access.
 *
 * @param groupId - The ID of the group to grant permissions to
 * @param databaseId - The ID of the database
 * @param allowAccess - Whether to grant or deny access (true = grant full access, false = no access)
 */
export async function setDatabasePermissionsForGroup({
  baseUrl,
  sessionToken,
  apiKey,
  groupId,
  databaseId,
  allowAccess = true,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupId: number
  databaseId: number
  allowAccess?: boolean
}): Promise<void> {
  try {
    // Get current permissions
    const permissionsResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/permissions/graph',
      method: 'GET',
    })

    if (!permissionsResponse.ok) {
      const errorText = await permissionsResponse.text()
      throw new Error(`Failed to fetch permissions graph: ${errorText}`)
    }

    const permissionsGraph = await permissionsResponse.json()

    // Create a deep copy of the permissions graph
    const updatedGraph = JSON.parse(JSON.stringify(permissionsGraph))

    // Ensure the groups object exists
    if (!updatedGraph.groups) {
      updatedGraph.groups = {}
    }

    // Update permissions for all groups
    Object.keys(updatedGraph.groups).forEach((gId) => {
      const groupIdNum = parseInt(gId, 10)

      // Ensure group object exists
      if (!updatedGraph.groups[gId]) {
        updatedGraph.groups[gId] = {}
      }

      if (groupIdNum === 2) {
        // Administrators group (ID: 2) always gets full access
        // Don't modify admin permissions - they should keep their existing permissions
        return
      } else if (groupIdNum === groupId && allowAccess) {
        // Grant full access to the specified group
        updatedGraph.groups[gId][databaseId] = {
          'view-data': 'unrestricted',
          'create-queries': 'query-builder-and-native',
          download: {
            schemas: 'full',
          },
          'data-model': {
            schemas: 'all',
          },
          details: 'yes',
        }
      } else if (groupIdNum === 1) {
        // For "All Users" group (ID: 1), restrict access
        updatedGraph.groups[gId][databaseId] = {
          'create-queries': 'no',
          'view-data': 'unrestricted',
          download: {
            schemas: 'full',
          },
        }
      } else {
        // For ALL other groups (not admin, not the specified group, not all users)
        // Set same permissions as "All Users" group - no create queries
        updatedGraph.groups[gId][databaseId] = {
          'create-queries': 'no',
          'view-data': 'unrestricted',
          download: {
            schemas: 'full',
          },
        }
      }
    })

    // Include revision if it exists
    const payload = {
      groups: updatedGraph.groups,
      revision: updatedGraph.revision || 0,
    }

    // Update the permissions
    const updateResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/permissions/graph',
      method: 'PUT',
      body: payload,
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update permissions: ${errorText}`)
    }

    const result = await updateResponse.json()
  } catch (error) {
    console.error(`❌ Error setting database permissions:`, error)
    throw error
  }
}
