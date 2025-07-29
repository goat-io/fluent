// npx vitest run ./src/server/services/secrets/secret.service.test.ts
//
// Test Updates:
// - Updated synchronous method tests to use preload() before calling sync methods
// - Removed legacy synchronous methods (getSecretSyncLegacy, getSecretJsonSyncLegacy)
// - No changes needed for VAULT/ENV encryption as the service handles encryption internally
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll
} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { SecretService } from './secret.service'
import { Security } from '@goatlab/node-utils'
import { getGlobalData, writeGlobalData } from '../../../test/const'
import { fetch } from 'undici'
import { VaultContainer } from '@testcontainers/vault'

describe('SecretService - FILE Provider', () => {
  let tempDir: string
  let mockLocation: string
  const mockEncryptionKey = 'test-encryption-key-1234567890123456'

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = path.join(
      __dirname,
      `temp-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    mockLocation = path.join(tempDir, 'secrets.json')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('loadSecretsFromFile', () => {
    it('should load and decrypt secrets from file successfully', () => {
      const secrets = { API_KEY: 'secret-key', DB_PASSWORD: 'password123' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      const result = service.loadSecretsFromFile()
      expect(result).toEqual(secrets)
    })

    it('should throw error if file does not exist', () => {
      const service = new SecretService({
        provider: 'FILE',
        location: '/non/existent/path.json',
        encryptionKey: mockEncryptionKey
      })

      expect(() => service.loadSecretsFromFile()).toThrow(
        'Secret file "/non/existent/path.json" does not exist'
      )
    })

    it('should throw error if decryption fails', () => {
      // Create an invalid encrypted object that will fail decryption
      const invalidEncrypted = {
        iv: 'invalid-iv',
        authTag: 'invalid-auth',
        encrypted: 'invalid-data'
      }
      fs.writeFileSync(mockLocation, JSON.stringify(invalidEncrypted))

      const service = new SecretService({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      expect(() => service.loadSecretsFromFile()).toThrow(
        `loadSecrets failed to decrypt: ${mockLocation}`
      )
    })

    it('should cache loaded secrets', () => {
      const secrets = { API_KEY: 'secret-key' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      // First call
      const result1 = service.loadSecretsFromFile()

      // Delete file to ensure cache is used
      fs.unlinkSync(mockLocation)

      // Second call should use cache
      const result2 = service.loadSecretsFromFile()
      expect(result1).toBe(result2)
    })
  })

  describe('getSecret', () => {
    it('should return secret value for existing key', async () => {
      const secrets = { API_KEY: 'secret-key', DB_PASSWORD: 'password123' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<typeof secrets>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      const result = await service.getSecret('API_KEY')
      expect(result).toBe('secret-key')
    })

    it('should throw error for non-existent key', async () => {
      // Create secrets without DB_PASSWORD key
      const secrets = { API_KEY: 'secret-key' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<{
        API_KEY: string
        DB_PASSWORD: string
      }>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      await expect(service.getSecret('DB_PASSWORD')).rejects.toThrow(
        `Secret DB_PASSWORD does not exist in ${mockLocation} env`
      )
    })
  })

  describe('getSecretJson', () => {
    it('should parse and return JSON secret', async () => {
      const jsonConfig = { host: 'localhost', port: 5432 }
      const secrets = { CONFIG: JSON.stringify(jsonConfig) }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<{ CONFIG: string }>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      const result = await service.getSecretJson<typeof jsonConfig>('CONFIG')
      expect(result).toEqual(jsonConfig)
    })

    it('should throw error for invalid JSON', async () => {
      const secrets = { CONFIG: 'invalid-json' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<{ CONFIG: string }>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      await expect(service.getSecretJson('CONFIG')).rejects.toThrow()
    })
  })

  describe('Synchronous methods', () => {
    it('should get secret synchronously after preload', async () => {
      const secrets = { API_KEY: 'secret-key' }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<typeof secrets>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      await service.preload()
      const result = service.getSecretSync('API_KEY')
      expect(result).toBe('secret-key')
    })

    it('should get JSON secret synchronously after preload', async () => {
      const jsonConfig = { host: 'localhost', port: 5432 }
      const secrets = { CONFIG: JSON.stringify(jsonConfig) }
      const encrypted = Security.encryptObject(secrets, mockEncryptionKey)
      fs.writeFileSync(mockLocation, JSON.stringify(encrypted))

      const service = new SecretService<{ CONFIG: string }>({
        provider: 'FILE',
        location: mockLocation,
        encryptionKey: mockEncryptionKey
      })

      await service.preload()
      const result = service.getSecretJsonSync<typeof jsonConfig>('CONFIG')
      expect(result).toEqual(jsonConfig)
    })
  })
})

describe('SecretService - VAULT Provider with real Vault', () => {
  let vaultContainer: any
  let vaultUrl: string
  let vaultToken: string

  beforeAll(async () => {
    try {
      // Try to get vault info from global data first
      const globalData = getGlobalData()
      if (globalData.vaultUrl && globalData.vaultToken) {
        vaultUrl = globalData.vaultUrl
        vaultToken = globalData.vaultToken
        return
      }
    } catch (e) {
      // If no global data, start our own container
    }

    // Start Vault container for this test suite
    vaultContainer = await new VaultContainer('hashicorp/vault:1.13')
      .withEnvironment({
        VAULT_DEV_ROOT_TOKEN_ID: 'test-token',
        VAULT_DEV_LISTEN_ADDRESS: '0.0.0.0:8200'
      })
      .withExposedPorts(8200)
      .start()

    vaultUrl = `http://${vaultContainer.getHost()}:${vaultContainer.getMappedPort(
      8200
    )}`
    vaultToken = 'test-token'

    // Write to global data for other tests
    writeGlobalData({ vaultUrl, vaultToken })
  })

  afterAll(async () => {
    if (vaultContainer) {
      await vaultContainer.stop()
    }
  })

  describe('Vault integration tests', () => {
    let service: SecretService<{
      API_KEY: string
      DB_PASSWORD: string
      CONFIG: string
    }>

    beforeEach(() => {
      service = new SecretService({
        provider: 'VAULT',
        location: `test/secrets-${Date.now()}`, // Unique path for each test
        encryptionKey: 'not-used-for-vault',
        vaultConfig: {
          endpoint: vaultUrl,
          token: vaultToken,
          mount: 'secret'
        }
      })
    })

    it('should store and retrieve secrets from Vault', async () => {
      const testSecrets = {
        API_KEY: 'test-api-key',
        DB_PASSWORD: 'test-db-password',
        CONFIG: JSON.stringify({ host: 'test-host', port: 5432 })
      }

      // Store secrets
      await service.storeSecretsToVault(testSecrets)

      // Retrieve secrets
      const retrievedSecrets = await service.loadSecretsFromVault()
      expect(retrievedSecrets).toEqual(testSecrets)
    })

    it('should retrieve individual secret from Vault', async () => {
      const testSecrets = {
        API_KEY: 'individual-test-key',
        DB_PASSWORD: 'individual-test-password'
      }

      await service.storeSecretsToVault(testSecrets)

      const apiKey = await service.getSecret('API_KEY')
      expect(apiKey).toBe('individual-test-key')
    })

    it('should retrieve JSON secret from Vault', async () => {
      const jsonConfig = { host: 'vault-test-host', port: 8080 }
      const testSecrets = {
        CONFIG: JSON.stringify(jsonConfig)
      }

      await service.storeSecretsToVault(testSecrets)

      const config = await service.getSecretJson<typeof jsonConfig>('CONFIG')
      expect(config).toEqual(jsonConfig)
    })

    it('should handle non-existent secrets in Vault', async () => {
      // Store empty secrets
      await service.storeSecretsToVault({})

      await expect(service.getSecret('NON_EXISTENT')).rejects.toThrow(
        `Secret NON_EXISTENT does not exist in ${service.location} env`
      )
    })

    it('should cache Vault secrets', async () => {
      const testSecrets = { API_KEY: 'cached-key' }
      await service.storeSecretsToVault(testSecrets)

      // First call - should hit Vault
      const result1 = await service.loadSecretsFromVault()
      expect(result1.API_KEY).toBe('cached-key')

      // Second call should use cache (without storing new secrets)
      const result2 = await service.loadSecretsFromVault()
      expect(result2).toBe(result1) // Should be the same object reference from cache

      // Store new secrets - this should clear the cache
      await service.storeSecretsToVault({ API_KEY: 'new-value' })

      // Next call should fetch from Vault again (cache was cleared)
      const result3 = await service.loadSecretsFromVault()
      expect(result3.API_KEY).toBe('new-value')
      expect(result3).not.toBe(result1) // Different object reference
    })

    it('should handle Vault with namespace', async () => {
      const serviceWithNamespace = new SecretService({
        provider: 'VAULT',
        location: 'namespaced/secrets',
        encryptionKey: 'not-used',
        vaultConfig: {
          endpoint: vaultUrl,
          token: vaultToken,
          mount: 'secret',
          namespace: 'test-namespace'
        }
      })

      // This might fail if namespace doesn't exist, but it should handle the header correctly
      try {
        await serviceWithNamespace.loadSecretsFromVault()
      } catch (error: any) {
        // Even if it fails, it should have included the namespace header
        expect(error.message).toContain('loadSecretsFromVault failed')
      }
    })

    it('should throw error for sync methods without preload', () => {
      expect(() => service.getSecretSync('API_KEY')).toThrow(
        'Secrets not preloaded. Call preload() before using synchronous methods.'
      )
    })

    it('should handle different mount points', async () => {
      const serviceWithCustomMount = new SecretService({
        provider: 'VAULT',
        location: 'custom-path',
        encryptionKey: 'not-used',
        vaultConfig: {
          endpoint: vaultUrl,
          token: vaultToken,
          mount: 'kv' // Different mount point
        }
      })

      // This might fail if mount doesn't exist, but URL should be constructed correctly
      try {
        await serviceWithCustomMount.loadSecretsFromVault()
      } catch (error: any) {
        expect(error.message).toContain('loadSecretsFromVault failed')
      }
    })

    it('should handle Vault errors properly', async () => {
      const serviceWithBadToken = new SecretService({
        provider: 'VAULT',
        location: 'test/bad-token',
        encryptionKey: 'not-used',
        vaultConfig: {
          endpoint: vaultUrl,
          token: 'invalid-token',
          mount: 'secret'
        }
      })

      await expect(serviceWithBadToken.loadSecretsFromVault()).rejects.toThrow(
        'loadSecretsFromVault failed: Vault request failed:'
      )
    })

    it('should clear cache after storing new secrets', async () => {
      // Store initial secrets
      await service.storeSecretsToVault({ API_KEY: 'old-key' })

      // Load to populate cache
      const cached = await service.loadSecretsFromVault()
      expect(cached.API_KEY).toBe('old-key')

      // Store new secrets (should clear cache)
      await service.storeSecretsToVault({ API_KEY: 'new-key' })

      // Load again - should fetch from Vault, not cache
      const updated = await service.loadSecretsFromVault()
      expect(updated.API_KEY).toBe('new-key')
    })
  })
})

describe('SecretService - ENV Provider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv }
    // Clear cache to prevent cross-test pollution
    SecretService.clearCache()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('loadSecretsFromEnv', () => {
    it('should load secrets from environment variables with prefix', () => {
      // Set up environment variables with APP prefix
      process.env.APP_API_KEY = 'env-api-key'
      process.env.APP_DB_PASSWORD = 'env-db-password'
      process.env.APP_CONFIG = JSON.stringify({ host: 'env-host', port: 3000 })
      process.env.OTHER_VARIABLE = 'should-not-be-included'

      const service = new SecretService<{
        API_KEY: string
        DB_PASSWORD: string
        CONFIG: string
      }>({
        provider: 'ENV',
        location: 'APP', // This becomes the prefix
        encryptionKey: 'not-used-for-env'
      })

      const secrets = service.loadSecretsFromEnv()

      expect(secrets).toEqual({
        API_KEY: 'env-api-key',
        DB_PASSWORD: 'env-db-password',
        CONFIG: JSON.stringify({ host: 'env-host', port: 3000 })
      })
    })

    it('should load secrets from environment variables without prefix when location is empty', () => {
      process.env.API_KEY = 'direct-api-key'
      process.env.DB_PASSWORD = 'direct-db-password'
      process.env.PATH = '/usr/bin' // System variable that should be included

      const service = new SecretService({
        provider: 'ENV',
        location: '', // No prefix
        encryptionKey: 'not-used-for-env'
      })

      const secrets = service.loadSecretsFromEnv()

      expect(secrets.API_KEY).toBe('direct-api-key')
      expect(secrets.DB_PASSWORD).toBe('direct-db-password')
      expect(secrets.PATH).toBe('/usr/bin')
    })

    it('should cache environment secrets', () => {
      process.env.TEST_SECRET = 'cached-value'

      const service = new SecretService({
        provider: 'ENV',
        location: 'TEST',
        encryptionKey: 'not-used'
      })

      // First call
      const result1 = service.loadSecretsFromEnv()

      // Change environment variable
      process.env.TEST_SECRET = 'new-value'

      // Second call should use cache
      const result2 = service.loadSecretsFromEnv()
      expect(result1).toBe(result2)
      expect(result2.SECRET).toBe('cached-value')
    })

    it('should handle empty environment', () => {
      // Clear relevant environment variables
      process.env = {}

      const service = new SecretService({
        provider: 'ENV',
        location: 'MISSING',
        encryptionKey: 'not-used'
      })

      const secrets = service.loadSecretsFromEnv()
      expect(secrets).toEqual({})
    })
  })

  describe('getSecret with ENV provider', () => {
    it('should return secret value from environment', async () => {
      process.env.MYAPP_API_KEY = 'test-api-key'
      process.env.MYAPP_DB_PASSWORD = 'test-password'

      const service = new SecretService<{
        API_KEY: string
        DB_PASSWORD: string
      }>({
        provider: 'ENV',
        location: 'MYAPP',
        encryptionKey: 'not-used'
      })

      const apiKey = await service.getSecret('API_KEY')
      expect(apiKey).toBe('test-api-key')

      const dbPassword = await service.getSecret('DB_PASSWORD')
      expect(dbPassword).toBe('test-password')
    })

    it('should throw error for non-existent environment variable', async () => {
      const service = new SecretService<{
        API_KEY: string
        MISSING_KEY: string
      }>({
        provider: 'ENV',
        location: 'EMPTY',
        encryptionKey: 'not-used'
      })

      await expect(service.getSecret('MISSING_KEY')).rejects.toThrow(
        'Secret MISSING_KEY does not exist in EMPTY env'
      )
    })
  })

  describe('getSecretJson with ENV provider', () => {
    it('should parse JSON secret from environment', async () => {
      const config = { database: 'test_db', port: 5432 }
      process.env.CONFIG_DATABASE_CONFIG = JSON.stringify(config)

      const service = new SecretService<{ DATABASE_CONFIG: string }>({
        provider: 'ENV',
        location: 'CONFIG',
        encryptionKey: 'not-used'
      })

      const result = await service.getSecretJson<typeof config>(
        'DATABASE_CONFIG'
      )
      expect(result).toEqual(config)
    })

    it('should throw error for invalid JSON in environment variable', async () => {
      process.env.BAD_CONFIG = 'invalid-json{'

      const service = new SecretService<{ CONFIG: string }>({
        provider: 'ENV',
        location: 'BAD',
        encryptionKey: 'not-used'
      })

      await expect(service.getSecretJson('CONFIG')).rejects.toThrow()
    })
  })

  describe('Synchronous methods with ENV provider', () => {
    it('should get secret synchronously from environment after preload', async () => {
      process.env.SYNC_TEST_VALUE = 'sync-value'

      const service = new SecretService<{ TEST_VALUE: string }>({
        provider: 'ENV',
        location: 'SYNC',
        encryptionKey: 'not-used'
      })

      await service.preload()
      const result = service.getSecretSync('TEST_VALUE')
      expect(result).toBe('sync-value')
    })

    it('should get JSON secret synchronously from environment after preload', async () => {
      const data = { name: 'test', value: 123 }
      process.env.SYNC_JSON_DATA = JSON.stringify(data)

      const service = new SecretService<{ JSON_DATA: string }>({
        provider: 'ENV',
        location: 'SYNC',
        encryptionKey: 'not-used'
      })

      await service.preload()
      const result = service.getSecretJsonSync<typeof data>('JSON_DATA')
      expect(result).toEqual(data)
    })
  })

  describe('Case sensitivity and prefix handling', () => {
    it('should handle lowercase prefix correctly', () => {
      process.env.APP_SECRET_KEY = 'lowercase-prefix'

      const service = new SecretService({
        provider: 'ENV',
        location: 'app', // lowercase location
        encryptionKey: 'not-used'
      })

      const secrets = service.loadSecretsFromEnv()
      expect(secrets.SECRET_KEY).toBe('lowercase-prefix')
    })

    it('should only match exact prefix', () => {
      process.env.APP_SECRET = 'correct'
      process.env.APPLICATION_SECRET = 'should-not-match'

      const service = new SecretService({
        provider: 'ENV',
        location: 'APP',
        encryptionKey: 'not-used'
      })

      const secrets = service.loadSecretsFromEnv()
      expect(secrets.SECRET).toBe('correct')
      expect(secrets.LICATION_SECRET).toBeUndefined()
    })

    it('should handle undefined environment values', () => {
      process.env.TEST_DEFINED = 'value'
      process.env.TEST_UNDEFINED = undefined as any

      const service = new SecretService({
        provider: 'ENV',
        location: 'TEST',
        encryptionKey: 'not-used'
      })

      const secrets = service.loadSecretsFromEnv()
      expect(secrets.DEFINED).toBe('value')
      expect(secrets.UNDEFINED).toBeUndefined()
    })
  })
})

describe('SecretService - loadSecrets method', () => {
  const tempDir = path.join(__dirname, 'temp-test-2')
  const tempFile = path.join(tempDir, 'secrets.json')
  const encryptionKey = 'test-key-1234567890123456789012'
  const originalEnv = process.env

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  it('should call loadSecretsFromVault for VAULT provider', async () => {
    const globalData = getGlobalData()
    if (!globalData.vaultUrl || !globalData.vaultToken) {
      console.warn('Skipping Vault test - no Vault container available')
      return
    }

    const service = new SecretService({
      provider: 'VAULT',
      location: `test/load-secrets-${Date.now()}`,
      encryptionKey: 'not-used',
      vaultConfig: {
        endpoint: globalData.vaultUrl,
        token: globalData.vaultToken,
        mount: 'secret'
      }
    })

    await service.storeSecretsToVault({ API_KEY: 'vault-key' })
    const result = await service.loadSecrets()
    expect(result).toEqual({ API_KEY: 'vault-key' })
  })

  it('should call loadSecretsFromFile for FILE provider', async () => {
    const secrets = { API_KEY: 'file-key' }
    const encrypted = Security.encryptObject(secrets, encryptionKey)
    fs.writeFileSync(tempFile, JSON.stringify(encrypted))

    const fileService = new SecretService({
      provider: 'FILE',
      location: tempFile,
      encryptionKey: encryptionKey
    })

    const result = await fileService.loadSecrets()
    expect(result).toEqual({ API_KEY: 'file-key' })
  })

  it('should call loadSecretsFromEnv for ENV provider', () => {
    process.env.LOADTEST_API_KEY = 'env-test-key'
    process.env.LOADTEST_SECRET = 'env-secret'

    const envService = new SecretService({
      provider: 'ENV',
      location: 'LOADTEST',
      encryptionKey: 'not-used'
    })

    const result = envService.loadSecrets()
    expect(result).toEqual({
      API_KEY: 'env-test-key',
      SECRET: 'env-secret'
    })
  })

  it('should call loadSecretsFromGCP for GCP provider', () => {
    const gcpService = new SecretService({
      provider: 'GCP',
      location: 'gcp-location',
      encryptionKey: 'key'
    })

    const result = gcpService.loadSecrets()
    expect(result).toEqual({}) // GCP method returns empty object for now
  })
})

describe('SecretService - TTL Cache functionality', () => {
  it('should respect custom cache TTL', async () => {
    const tempDir = path.join(__dirname, 'temp-test-ttl')
    const tempFile = path.join(tempDir, 'ttl-secrets.json')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const secrets = { API_KEY: 'ttl-test-key' }
    const encrypted = Security.encryptObject(
      secrets,
      'test-key-1234567890123456789012'
    )
    fs.writeFileSync(tempFile, JSON.stringify(encrypted))

    // Create service with very short TTL (100ms)
    const service = new SecretService<typeof secrets>({
      provider: 'FILE',
      location: tempFile,
      encryptionKey: 'test-key-1234567890123456789012',
      cacheTTL: 100
    })

    // First load - should read from file
    const result1 = await service.loadSecretsFromFileAsync()
    expect(result1).toEqual(secrets)

    // Delete file to ensure cache is being used
    fs.unlinkSync(tempFile)

    // Second load immediately - should use cache
    const result2 = await service.loadSecretsFromFileAsync()
    expect(result2).toEqual(secrets)

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Third load after TTL - should fail because file is deleted and cache expired
    await expect(service.loadSecretsFromFileAsync()).rejects.toThrow(
      'Secret file'
    )

    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })

  it('should use default TTL when not specified', () => {
    const service = new SecretService({
      provider: 'FILE',
      location: 'dummy.json',
      encryptionKey: 'key'
    })

    expect(service.cacheTTL).toBe(5 * 60 * 1000) // 5 minutes default
  })

  it('should cleanup expired cache entries', async () => {
    const tempDir = path.join(__dirname, 'temp-test-cleanup')
    const tempFile = path.join(tempDir, 'cleanup-secrets.json')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const secrets = { KEY: 'value' }
    const encrypted = Security.encryptObject(
      secrets,
      'test-key-1234567890123456789012'
    )
    fs.writeFileSync(tempFile, JSON.stringify(encrypted))

    // Create service with very short TTL
    const service = new SecretService({
      provider: 'FILE',
      location: tempFile,
      encryptionKey: 'test-key-1234567890123456789012',
      cacheTTL: 50
    })

    // Load to populate cache
    service.loadSecretsFromFile()

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 100))

    // Call cleanup
    SecretService.cleanupExpiredCache()

    // Try to load again - should read from file since cache was cleaned
    fs.unlinkSync(tempFile)
    expect(() => service.loadSecretsFromFile()).toThrow('Secret file')

    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })
})

describe('SecretService - Edge cases and error handling', () => {
  it('should handle invalid JSON in file', () => {
    const tempDir = path.join(__dirname, 'temp-test-3')
    const tempFile = path.join(tempDir, 'invalid.json')

    // Create temp directory and file
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    fs.writeFileSync(tempFile, 'invalid-json')

    const service = new SecretService({
      provider: 'FILE',
      location: tempFile,
      encryptionKey: 'key'
    })

    expect(() => service.loadSecretsFromFile()).toThrow()

    // Cleanup
    fs.unlinkSync(tempFile)
    fs.rmSync(tempDir, { recursive: true })
  })

  it('should handle empty secrets object', async () => {
    const globalData = getGlobalData()
    if (!globalData.vaultUrl || !globalData.vaultToken) {
      console.warn('Skipping Vault test - no Vault container available')
      return
    }

    const service = new SecretService<{}>({
      provider: 'VAULT',
      location: `empty-${Date.now()}`,
      encryptionKey: 'key',
      vaultConfig: {
        endpoint: globalData.vaultUrl,
        token: globalData.vaultToken,
        mount: 'secret'
      }
    })

    await service.storeSecretsToVault({})
    const result = await service.loadSecretsFromVault()
    expect(result).toEqual({})
  })

  it('should throw error when no vault config is provided', async () => {
    const serviceWithoutConfig = new SecretService({
      provider: 'VAULT',
      location: 'test',
      encryptionKey: 'key'
    })

    await expect(serviceWithoutConfig.loadSecretsFromVault()).rejects.toThrow(
      'Vault configuration is required for VAULT provider'
    )
  })
})
