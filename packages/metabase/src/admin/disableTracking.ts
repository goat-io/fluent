export async function disableTracking({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<Response> {
  const response = await fetch(`${baseUrl}/api/setting/anon-tracking-enabled`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': sessionToken || '',
      'X-Api-Key': apiKey || '',
    },
    body: JSON.stringify({ value: false }),
  })

  if (!response.ok) {
    console.error('❌ Failed to disableTracking', await response.text())
    throw new Error(`Failed to disableTracking${baseUrl}`)
  }

  return response
}
