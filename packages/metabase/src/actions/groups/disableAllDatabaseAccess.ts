import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Restricts database access for a specific group using the data permissions endpoint
 *
 * For the free/open-source version of Metabase, we set create-queries to 'no'
 * while keeping view-data as 'unrestricted'. This prevents users from creating
 * new queries while still allowing them to see existing dashboards/questions.
 *
 * Note: The 'blocked' permission level requires a premium Metabase license.
 */
export async function disableAllDatabaseAccess({
  baseUrl,
  sessionToken,
  apiKey,
  groupId,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupId: number
}): Promise<void> {

  try {
    // First, fetch all databases to ensure we have the complete list
    const databasesResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/database',
      method: 'GET',
    })

    if (!databasesResponse.ok) {
      const errorText = await databasesResponse.text()
      throw new Error(`Failed to fetch databases: ${errorText}`)
    }

    const databases = await databasesResponse.json() as { data: Array<{ id: number; name: string }> }

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

    // Ensure the specific group exists
    if (!updatedGraph.groups[groupId]) {
      updatedGraph.groups[groupId] = {}
    }

    // Set permissions to match what Metabase dashboard does for "All Users" group
    // This prevents query creation while still showing in the UI
    databases.data.forEach((db) => {

      // Match the exact structure from Metabase dashboard
      updatedGraph.groups[groupId][db.id] = {
        'create-queries': 'no',
        'view-data': 'unrestricted',
        download: {
          schemas: 'full',
        },
      }
    })

    // Also update any existing database permissions for this group
    if (updatedGraph.groups[groupId]) {
      Object.keys(updatedGraph.groups[groupId]).forEach((dbId) => {
        if (
          dbId !== 'null' &&
          !databases.data.find((db) => String(db.id) === dbId)
        ) {
          updatedGraph.groups[groupId][dbId] = {
            'create-queries': 'no',
            'view-data': 'unrestricted',
            download: {
              schemas: 'full',
            },
          }
        }
      })
    }

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
      console.error('❌ Update failed:', errorText)
      throw new Error(`Failed to update permissions: ${errorText}`)
    }



  } catch (error) {
    console.error(`❌ Error disabling database access:`, error)
    throw error
  }
}

/**
 * Disables all database access for the "All Users" group (ID: 1)
 */
export async function disableAllUsersGroupDatabaseAccess({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<void> {
  const ALL_USERS_GROUP_ID = 1


  return disableAllDatabaseAccess({
    baseUrl,
    sessionToken,
    apiKey,
    groupId: ALL_USERS_GROUP_ID,
  })
}
