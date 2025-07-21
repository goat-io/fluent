// Fetch the embedding secret key from Metabase
export async function getEmbeddingSecretKey({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}) {

  const response = await fetch(`${baseUrl}/api/setting/embedding-secret-key`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': sessionToken || '',
      'X-Api-Key': apiKey || '',
    },
  })

  if (response.ok) {
    let embeddingSecretKey = await response.text()
    // Remove quotes if the response is a JSON string
    embeddingSecretKey = embeddingSecretKey.replace(/^"|"$/g, '')
    return embeddingSecretKey
  } else {
    const errorText = await response.text()
    console.error('❌ Failed to fetch embedding secret key:', errorText)
    throw new Error(`Failed to fetch embedding secret key: ${errorText}`)
  }
}
