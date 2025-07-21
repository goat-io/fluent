import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Lists all permission groups in Metabase
 * @param options - Configuration for listing groups
 * @returns Array of group objects
 */
export async function listGroups({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<Array<{ id: number; name: string; member_count?: number }>> {
  console.log('🔍 Fetching all groups...')

  const response = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/permissions/group',
    method: 'GET',
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Failed to fetch groups:', errorText)
    throw new Error(`Failed to fetch groups: ${errorText}`)
  }

  const groups = await response.json() as Array<{ id: number; name: string; member_count?: number }>
  console.log(`✅ Found ${groups.length} groups`)
  
  return groups
}