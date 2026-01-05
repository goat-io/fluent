import { metabaseFetch } from '../common/fetch-wrapper'

interface LoginResponse {
  id: string
}

/**
 * Authenticates with Metabase using username and password
 * @param params - Login credentials and base URL
 * @returns Session token for authenticated requests
 * @throws Error if login fails
 */
export async function loginAdminUser({
  userName,
  password,
  baseUrl,
}: {
  userName: string
  password: string
  baseUrl: string
}): Promise<string> {
  try {
    const loginRes = await metabaseFetch({
      baseUrl,
      endpoint: '/api/session',
      method: 'POST',
      body: {
        username: userName,
        password: password,
      },
    })

    const loginData = (await loginRes.json()) as LoginResponse
    return loginData.id
  } catch (_error) {
    throw new Error(`Failed to login as ${userName}`)
  }
}
