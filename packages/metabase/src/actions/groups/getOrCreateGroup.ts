import { metabaseFetch } from '../../common/fetch-wrapper'
import { createGroup } from './createGroup'

/**
 * Gets an existing group or creates it if it doesn't exist
 * @param options - Configuration for getting or creating the group
 * @returns The group object with id and name
 */
export async function getOrCreateGroup({
  baseUrl,
  sessionToken,
  apiKey,
  groupName
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupName: string
}): Promise<{ id: number; name: string }> {
  // Fetch existing groups
  const response = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/permissions/group',
    method: 'GET'
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Failed to fetch groups:', errorText)
    throw new Error(`Failed to fetch groups: ${errorText}`)
  }

  const groups = (await response.json()) as Array<{ id: number; name: string }>

  // Check if group already exists
  const existingGroup = groups.find(group => group.name === groupName)

  if (existingGroup) {
    return existingGroup
  }

  // Create new group if it doesn't exist
  return createGroup({
    baseUrl,
    sessionToken,
    apiKey,
    groupName
  })
}
