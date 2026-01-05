// Example: Using SecretService with preloading in Container

import { Container } from '../../../../container/Container'
import { SecretService } from '../secret.service'

// Example service interfaces (replace with your actual services)
interface DatabaseService {
  connect(): Promise<void>
  query(sql: string): Promise<any>
}

interface ApiService {
  getUser(userId: string, apiKey: string): Promise<any>
  processData(apiKey: string): Promise<any>
}

// Define your secret types
interface AppSecrets {
  API_KEY: string
  DB_CONNECTION_STRING: string
  JWT_SECRET: string
  REDIS_PASSWORD: string
}

// Define tenant metadata
interface TenantMeta {
  tenantId: string
  secretsLocation: string
  encryptionKey: string
  vaultConfig?: {
    endpoint: string
    token: string
  }
}

// Define your service factories (mock for example)
const factories = {
  secrets: SecretService<AppSecrets>,
  database: class MockDatabaseService implements DatabaseService {
    constructor(
      private tenantId: string,
      private config: any,
    ) {}
    async connect() {
      console.log('Connected to DB')
    }
    async query(_sql: string) {
      return []
    }
  },
  api: class MockApiService implements ApiService {
    constructor(
      private tenantId: string,
      private config: any,
    ) {}
    async getUser(userId: string, _apiKey: string) {
      return { id: userId }
    }
    async processData(_apiKey: string) {
      return { processed: true }
    }
  },
}

// Create container with preloading pattern
const container = new Container(
  factories,
  async (preload, meta: TenantMeta) => {
    // Create secret service instance
    const secretService = preload.secrets(meta.tenantId, {
      provider: 'FILE', // or 'VAULT', 'ENV'
      location: meta.secretsLocation,
      encryptionKey: meta.encryptionKey,
      vaultConfig: meta.vaultConfig,
    })

    // Preload secrets before using them
    await secretService.preload()

    // Now we can use synchronous methods to get secrets
    const dbConnectionString = secretService.getSecretSync(
      'DB_CONNECTION_STRING',
    )
    const jwtSecret = secretService.getSecretSync('JWT_SECRET')

    // Create other services using the preloaded secrets
    const database = preload.database(meta.tenantId, meta.tenantId, {
      connectionString: dbConnectionString,
    })

    const api = preload.api(meta.tenantId, meta.tenantId, {
      database,
      jwtSecret,
    })

    return {
      secrets: secretService,
      database,
      api,
    }
  },
)

// Usage example
async function _processRequest(tenantMeta: TenantMeta, userId: string) {
  await container.bootstrap(tenantMeta, async () => {
    const { api, secrets } = container.context

    // Secrets are already preloaded, so we can use sync methods
    const apiKey = secrets.getSecretSync('API_KEY')

    // Use services
    const user = await api.getUser(userId, apiKey)
    return user
  })
}

// Example with multiple providers
async function _multiProviderExample() {
  // FILE provider for development
  const _devTenant: TenantMeta = {
    tenantId: 'dev-tenant',
    secretsLocation: '/secrets/dev.json',
    encryptionKey: 'dev-encryption-key-32chars',
  }

  // VAULT provider for production
  const _prodTenant: TenantMeta = {
    tenantId: 'prod-tenant',
    secretsLocation: 'production/secrets',
    encryptionKey: 'prod-encryption-key-32chars',
    vaultConfig: {
      endpoint: 'https://vault.company.com',
      token: process.env.VAULT_TOKEN!,
    },
  }

  // ENV provider for CI/CD
  const _ciTenant: TenantMeta = {
    tenantId: 'ci-tenant',
    secretsLocation: 'CI', // Will look for CI_API_KEY, CI_DB_CONNECTION_STRING, etc.
    encryptionKey: 'ci-encryption-key-32chars',
  }
}

// Example with automatic invalidation (FILE provider)
async function _fileWatchingExample() {
  const _container = new Container(
    factories,
    async (preload, meta: TenantMeta) => {
      const secretService = preload.secrets(meta.tenantId, {
        provider: 'FILE',
        location: meta.secretsLocation,
        encryptionKey: meta.encryptionKey,
        cacheTTL: 60000, // 1 minute cache
      })

      // Enable automatic reload on file changes
      await secretService.preload()

      // Secrets will automatically reload if the file changes
      return { secrets: secretService }
    },
  )

  // The secret service will watch for file changes and reload automatically
}

// Example with batch operations
async function _batchTenantProcessing() {
  const tenants: TenantMeta[] = [
    {
      tenantId: 'tenant1',
      secretsLocation: '/secrets/tenant1.json',
      encryptionKey: 'key1',
    },
    {
      tenantId: 'tenant2',
      secretsLocation: '/secrets/tenant2.json',
      encryptionKey: 'key2',
    },
    {
      tenantId: 'tenant3',
      secretsLocation: '/secrets/tenant3.json',
      encryptionKey: 'key3',
    },
  ]

  const results = await container.bootstrapBatch(
    tenants.map(meta => ({
      metadata: meta,
      fn: async () => {
        const { secrets, api } = container.context

        // Each tenant has its own preloaded secrets
        const apiKey = secrets.getSecretSync('API_KEY')

        // Process tenant data
        return api.processData(apiKey)
      },
    })),
    {
      concurrency: 5,
      continueOnError: true,
      onProgress: (completed, total) => {
        console.log(`Processed ${completed}/${total} tenants`)
      },
    },
  )

  // Check results
  for (const result of results) {
    if (result.status === 'success') {
      console.log(`Tenant ${result.metadata.tenantId} processed successfully`)
    } else {
      console.error(`Tenant ${result.metadata.tenantId} failed:`, result.error)
    }
  }
}

// Cleanup when done
async function _cleanup() {
  // Dispose all services (including secret watchers)
  await container.disposeAll()
}
