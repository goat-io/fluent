import { metabaseFetch } from '../common/fetch-wrapper'
import { loginAdminUser } from './loginAdminUser'

interface SessionPropertiesResponse {
  'setup-token': string
  'has-user-setup': boolean
  [key: string]: string | boolean | number
}

interface SetupResponse {
  id: string
}

/**
 * Creates the initial admin user for Metabase or logs in if already exists
 * @param params - Admin user credentials and base URL
 * @returns Session token for authenticated requests
 * @throws Error if user creation fails
 */
export async function createAdminUser({
  userName,
  password,
  baseUrl
}: {
  userName: string
  password: string
  baseUrl: string
}) {
  // Get setup token and check if setup is needed
  const propertiesRes = await metabaseFetch({
    baseUrl,
    endpoint: '/api/session/properties',
    method: 'GET'
  })

  const properties = (await propertiesRes.json()) as SessionPropertiesResponse

  // Check if setup has already been completed
  if (properties['has-user-setup']) {
    return await loginAdminUser({ userName, password, baseUrl })
  }

  const setupToken = properties['setup-token']
  if (!setupToken) {
    throw new Error(
      'No setup token available - Metabase may already be configured'
    )
  }

  // Create admin user
  const setupRes = await metabaseFetch({
    baseUrl,
    endpoint: '/api/setup',
    method: 'POST',
    body: {
      token: setupToken,
      user: {
        email: userName,
        first_name: 'Metabase',
        last_name: 'Admin',
        password: password,
        site_name: 'Sodium Platform' // This is actually part of user object in newer versions
      },
      prefs: {
        site_name: 'Sodium Metabase',
        site_locale: 'en',
        allow_tracking: false
      },
      database: null // Skip database setup, we'll add it later
    }
  })

  const setupData = (await setupRes.json()) as SetupResponse
  const sessionToken = setupData.id

  return sessionToken
}
