import { metabaseFetch } from '../../common/fetch-wrapper'

export type PermissionLevel = 'all' | 'none' | 'block' | 'controlled' | 'write'

export interface DatabasePermissions {
  schemas?: 'all' | 'none' | 'block' | 'controlled'
  native?: 'all' | 'none' | 'write'
}

/**
 * Updates permissions for a specific group and database
 * @param options - Configuration for updating group permissions
 */
export async function updateGroupPermissions({
  baseUrl,
  sessionToken,
  apiKey,
  groupId,
  databaseId,
  permissions
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupId: number
  databaseId: number
  permissions: DatabasePermissions
}): Promise<void> {
  console.log(
    `🔐 Updating permissions for group ${groupId} on database ${databaseId}...`
  )

  try {
    // First, get the current permissions graph
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

    const permissionsGraph = (await permissionsResponse.json()) as Record<
      string,
      any
    >

    // Create updated permissions
    const updatedGraph = { ...permissionsGraph }

    // Ensure the group exists in the graph
    if (!updatedGraph.groups[groupId]) {
      updatedGraph.groups[groupId] = {}
    }

    // Update permissions for the specific database
    updatedGraph.groups[groupId][databaseId] = {
      data: permissions
    }

    // Update the permissions graph
    const updateResponse = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/permissions/graph',
      method: 'PUT',
      body: updatedGraph
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update permissions: ${errorText}`)
    }

    console.log(
      `✅ Successfully updated permissions for group ${groupId} on database ${databaseId}`
    )
  } catch (error) {
    console.error(`❌ Error updating permissions:`, error)
    throw error
  }
}
