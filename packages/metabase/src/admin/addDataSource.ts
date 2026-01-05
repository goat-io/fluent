import { setDatabasePermissionsForGroup } from '../actions/groups/setDatabasePermissionsForGroup'
import { metabaseFetch } from '../common/fetch-wrapper'
import { enableActionsInDatasource } from './enableActionsInDatasource'

interface MetabaseDatabase {
  id: number
  name: string
  engine: string
  details?: Record<string, unknown>
  is_on_demand?: boolean
  is_full_sync?: boolean
}

interface MetabaseDatabaseListResponse {
  data: MetabaseDatabase[]
}

export interface MetabaseDatasourceInput {
  dbHost: string
  dbName: string
  dbPort: string | null | number
  dbUser: string
  dbPassword: string | null
  dbNameInMetabase: string
  engine: 'mysql' | 'postgres'
}

/**
 * Adds a database source to Metabase or returns existing database ID
 * @param params - Database configuration and authentication details
 * @param restrictToGroupId - Optional group ID to restrict access to (if not provided, default Metabase permissions apply)
 * @returns Database ID in Metabase
 * @throws Error if database creation fails
 */
export async function addDataSource({
  baseUrl,
  sessionToken,
  apiKey,
  dbHost,
  dbName,
  dbNameInMetabase,
  dbPassword,
  dbPort,
  dbUser,
  engine,
  restrictToGroupId,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  restrictToGroupId?: number
} & MetabaseDatasourceInput): Promise<number> {
  // Fetch existing databases using the wrapper
  const existingDatabasesRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/database',
    method: 'GET',
  })

  const existingDatabases =
    (await existingDatabasesRes.json()) as MetabaseDatabaseListResponse

  const dbExists = existingDatabases.data.find(
    db => db.name === dbNameInMetabase,
  )

  if (dbExists) {
    // Even if database exists, we need to update permissions if requested
    if (restrictToGroupId !== undefined) {
      try {
        await setDatabasePermissionsForGroup({
          baseUrl,
          sessionToken,
          apiKey,
          groupId: restrictToGroupId,
          databaseId: dbExists.id,
          allowAccess: true,
        })
      } catch (error) {
        console.warn(
          `⚠️  Failed to set group permissions for existing database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }
    return dbExists.id
  }

  // Prepare database configuration
  const databaseConfig = {
    engine,
    name: dbNameInMetabase,
    details: {
      host: dbHost,
      port: dbPort ? Number.parseInt(dbPort.toString(), 10) : null,
      dbname: dbName,
      user: dbUser,
      password: dbPassword,
      tunnel_enabled: false,
      ssl: false,
      // Additional MySQL-specific settings
      ...(engine === 'mysql' && {
        additional_options: null,
        use_compression: false,
        use_ssl: false,
      }),
      // Additional Postgres-specific settings
      ...(engine === 'postgres' && {
        ssl_mode: 'prefer',
        use_srv_lookup: false,
      }),
    },
    is_full_sync: true,
    is_on_demand: false,
    schedules: {},
    auto_run_queries: true,
  }

  // Create database
  const createResponse = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/database',
    method: 'POST',
    body: databaseConfig,
  })

  const response = (await createResponse.json()) as MetabaseDatabase

  // Set permissions for specific group if requested
  if (restrictToGroupId !== undefined) {
    try {
      await setDatabasePermissionsForGroup({
        baseUrl,
        sessionToken,
        apiKey,
        groupId: restrictToGroupId,
        databaseId: response.id,
        allowAccess: true,
      })
    } catch (error) {
      console.warn(
        `⚠️  Failed to set group permissions for database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      // Don't fail the entire operation if permissions can't be set
    }
  }

  // Enable actions for the newly created database
  try {
    await enableActionsInDatasource({
      baseUrl,
      dbId: response.id,
      sessionToken,
      apiKey,
    })
  } catch (error) {
    console.warn(
      `⚠️  Failed to enable actions for database: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    // Don't fail the entire operation if actions can't be enabled
  }

  return response.id
}
