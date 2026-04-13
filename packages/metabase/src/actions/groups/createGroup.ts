import { metabaseFetch } from '../../common/fetch-wrapper'

/**
 * Creates a new permission group in Metabase
 * @param options - Configuration for creating the group
 * @returns The created group object with id and name
 */
export async function createGroup({
  baseUrl,
  sessionToken,
  apiKey,
  groupName,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  groupName: string
}): Promise<{ id: number; name: string }> {
  console.log(`🔨 Creating group '${groupName}'...`)

  const response = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/permissions/group',
    method: 'POST',
    body: { name: groupName },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Failed to create group '${groupName}':`, errorText)
    throw new Error(`Failed to create group '${groupName}': ${errorText}`)
  }

  const group = (await response.json()) as { id: number; name: string }
  console.log(`✅ Group '${groupName}' created successfully (ID: ${group.id})`)

  return group
}
