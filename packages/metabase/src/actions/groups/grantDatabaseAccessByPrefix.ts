import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Grants full database access to a group for all databases that start with the group name.
 * This enables multi-tenant access control where database names follow a naming convention.
 *
 * @param groupName - The name of the group (will be used as prefix to match databases)
 * @param groupId - The ID of the group to grant permissions to
 */
export async function grantDatabaseAccessByPrefix({
  baseUrl,
  sessionToken,
  apiKey,
  groupName,
  groupId
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupName: string
  groupId: number
}): Promise<void> {
  try {
    // First, fetch all databases
    const databasesResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/database',
      method: 'GET'
    })

    if (!databasesResponse.ok) {
      const errorText = await databasesResponse.text()
      throw new Error(`Failed to fetch databases: ${errorText}`)
    }

    const databases = (await databasesResponse.json()) as {
      data: Array<{ id: number; name: string }>
    }

    // Filter databases that start with the group name (case-insensitive)
    const matchingDatabases = databases.data.filter(db =>
      db.name.toLowerCase().startsWith(groupName.toLowerCase())
    )

    if (matchingDatabases.length === 0) {
      return
    }

    // Get current permissions
    const permissionsResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/permissions/graph',
      method: 'GET'
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

    // Ensure the specific group exists
    if (!updatedGraph.groups[groupId]) {
      updatedGraph.groups[groupId] = {}
    }

    // Grant full access to matching databases
    matchingDatabases.forEach((db: any) => {
      // Full access permissions structure
      updatedGraph.groups[groupId][db.id] = {
        'view-data': 'unrestricted',
        'create-queries': 'query-builder-and-native',
        download: {
          schemas: 'full'
        },
        'data-model': {
          schemas: 'all'
        },
        details: 'yes'
      }
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
      endpoint: '/api/permissions/graph',
      method: 'PUT',
      body: payload
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error('❌ Update failed:', errorText)
      throw new Error(`Failed to update permissions: ${errorText}`)
    }
  } catch (error) {
    console.error(`❌ Error granting database access:`, error)
    throw error
  }
}
