export async function enableActionsInDatasource({
  baseUrl,
  sessionToken,
  apiKey,
  dbId
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  dbId: number
}): Promise<Response> {
  const response = await fetch(`${baseUrl}/api/database/${dbId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': sessionToken || '',
      'X-Api-Key': apiKey || ''
    },
    body: JSON.stringify({ settings: { 'database-enable-actions': true } })
  })

  if (!response.ok) {
    console.error(
      '❌ Failed to enable actions in datasource:',
      await response.text()
    )
    throw new Error(`Failed to enable actions in datasource ${baseUrl}`)
  }

  return response
}
