export async function disableOnboardingSidebar({
  baseUrl,
  sessionToken,
  apiKey,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
}): Promise<Response> {
  // Create database if not found
  const response = await fetch(
    `${baseUrl}/api/setting/dismissed-onboarding-sidebar-link`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken || '',
        'X-Api-Key': apiKey || '',
      },
      body: JSON.stringify({ value: true }),
    },
  )

  if (!response.ok) {
    console.error(
      '❌ Failed to disable OnboardingSidebar',
      await response.text(),
    )
    throw new Error(`Failed to disable OnboardingSidebar${baseUrl}`)
  }

  return response
}
