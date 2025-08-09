import * as fs from 'node:fs'
import { promises as fsPromises } from 'node:fs'
import type { StringMap } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import { magenta } from 'kleur/colors'
import { fetch } from 'undici'

// Cache entry interface with TTL support
interface CacheEntry<T> {
  data: T
  expiresAt?: number // Unix timestamp when the entry expires
}

// Enhanced cache with TTL support
const memoryCache: Record<string, CacheEntry<StringMap> | undefined> = {}

// Default TTL in milliseconds (5 minutes)
const DEFAULT_TTL_MS = 5 * 60 * 1000

// type SecretType = typeof secrets

export type SecretProvider = 'GCP' | 'FILE' | 'VAULT' | 'ENV'

export interface VaultConfig {
  endpoint: string
  token?: string
  mount?: string
  namespace?: string
}

export interface SecretServiceConfig {
  provider: SecretProvider
  location: string
  encryptionKey?: string // Made optional - only decrypt when provided
  vaultConfig?: VaultConfig
  cacheTTL?: number // TTL in milliseconds
}

export class SecretService<SecretType> {
  provider: SecretProvider
  location: string
  encryptionKey?: string // Made optional
  vaultConfig?: VaultConfig
  cacheTTL: number
  protected preloadedSecrets?: SecretType
  protected isPreloaded: boolean = false
  private fileWatcher?: fs.FSWatcher

  constructor(config: SecretServiceConfig) {
    this.provider = config.provider
    this.location = config.location
    this.encryptionKey = config.encryptionKey // Optional now
    this.vaultConfig = config.vaultConfig
    this.cacheTTL = config.cacheTTL ?? DEFAULT_TTL_MS
  }

  /**
   * Preload secrets asynchronously for synchronous access later
   * This method loads secrets once and stores them in the instance
   */
  async preload(): Promise<void> {
    try {
      const secrets = await this.loadSecretsAsync()
      this.preloadedSecrets = secrets
      this.isPreloaded = true

      // Set up file watching for automatic invalidation (FILE provider only)
      if (this.provider === 'FILE' && !this.fileWatcher) {
        this.setupFileWatcher()
      }
    } catch (error: any) {
      this.isPreloaded = false
      throw new Error(`Failed to preload secrets: ${error.message}`)
    }
  }

  /**
   * Invalidate preloaded secrets and stop file watching
   */
  async invalidate(): Promise<void> {
    this.preloadedSecrets = undefined
    this.isPreloaded = false

    // Clear cache to force reload
    if (this.provider === 'FILE') {
      delete memoryCache[this.location]
    } else if (this.provider === 'ENV') {
      delete memoryCache[`env_${this.location}`]
    } else if (this.provider === 'VAULT' && this.vaultConfig) {
      delete memoryCache[`vault_${this.vaultConfig.endpoint}_${this.location}`]
    }

    // Stop file watching
    if (this.fileWatcher) {
      this.fileWatcher.close()
      this.fileWatcher = undefined
    }
  }

  /**
   * Set up file watching for automatic invalidation
   */
  private setupFileWatcher(): void {
    if (this.provider !== 'FILE') {
      return
    }

    try {
      this.fileWatcher = fs.watch(this.location, async eventType => {
        if (eventType === 'change') {
          console.log(`🔄 Secret file changed: ${magenta(this.location)}`)
          await this.invalidate()
          // Optionally auto-reload
          try {
            await this.preload()
            console.log(`✅ Secrets reloaded successfully`)
          } catch (error: any) {
            console.error(`❌ Failed to reload secrets: ${error.message}`)
          }
        }
      })
    } catch (error: any) {
      console.warn(`⚠️ Failed to set up file watching: ${error.message}`)
    }
  }

  /**
   * Load secrets asynchronously with decryption for all providers
   */
  private async loadSecretsAsync(): Promise<SecretType> {
    let secrets: any

    switch (this.provider) {
      case 'FILE':
        secrets = await this.loadSecretsFromFileAsync()
        break
      case 'ENV':
        secrets = this.loadSecretsFromEnv()
        break
      case 'VAULT':
        secrets = await this.loadSecretsFromVault()
        break
      case 'GCP':
        secrets = this.loadSecretsFromGCP()
        break
      default:
        throw new Error(`Unknown provider: ${this.provider}`)
    }

    // No need to decrypt here as each provider method already handles decryption

    return secrets as SecretType
  }

  // Helper method to check if cache entry is valid
  private isCacheValid(entry: CacheEntry<StringMap> | undefined): boolean {
    if (!entry) {
      return false
    }
    if (!entry.expiresAt) {
      return true // No expiration set
    }
    return Date.now() < entry.expiresAt
  }

  // Helper method to set cache with TTL
  private setCache(key: string, data: StringMap, ttl?: number): void {
    const expiresAt = ttl ? Date.now() + ttl : undefined
    memoryCache[key] = { data, expiresAt }
  }

  // Helper method to get from cache
  private getCache(key: string): StringMap | undefined {
    const entry = memoryCache[key]
    if (this.isCacheValid(entry)) {
      return entry?.data
    }
    // Clear expired entry
    if (entry) {
      delete memoryCache[key]
    }
    return undefined
  }
  // Async version of loadSecretsFromFile
  async loadSecretsFromFileAsync(): Promise<SecretType> {
    const cached = this.getCache(this.location)
    if (cached) {
      return cached as any as SecretType
    }

    const start = process.hrtime.bigint()

    try {
      // Check if file exists using async stat
      await fsPromises.stat(this.location)
    } catch (_error) {
      throw new Error(`Secret file "${this.location}" does not exist`)
    }

    try {
      const fileContents = await fsPromises.readFile(this.location, 'utf-8')

      // Try to parse as JSON, fall back to plain text if it fails
      let secretEncryptedObject: any
      try {
        secretEncryptedObject = JSON.parse(fileContents)
      } catch (jsonError) {
        console.log(jsonError)
        // Not JSON, treat as plain text secret
        // Store it as an object with a 'value' key for consistency
        secretEncryptedObject = { value: fileContents.trim() }
      }

      console.log(
        `🔐 Secrets loaded: ${magenta(
          this.location.split('/').slice(-2).join('/')
        )}`
      )

      // Only decrypt if encryptionKey is provided
      let secrets = secretEncryptedObject
      if (this.encryptionKey) {
        try {
          secrets = Security.decryptObject(
            secretEncryptedObject,
            this.encryptionKey!
          )
        } catch (decryptError: any) {
          console.warn(
            `Failed to decrypt secrets from file: ${decryptError.message}`
          )
          // Fall back to using the raw secrets if decryption fails
          secrets = secretEncryptedObject
        }
      }

      this.setCache(this.location, secrets, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `⏱️ loadSecrets(${this.location}) took ${durationMs.toFixed(3)}ms`
      )
      return secrets as any as SecretType
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON in secret file: ${this.location}`)
      }
      console.error(err)
      throw new Error(`loadSecrets failed to load: ${this.location}`)
    }
  }

  // Synchronous version for backward compatibility
  loadSecretsFromFile(): SecretType {
    const cached = this.getCache(this.location)
    if (cached) {
      return cached as any as SecretType
    }

    if (!fs.existsSync(this.location)) {
      throw new Error(`Secret file "${this.location}" does not exist`)
    }

    const start = process.hrtime.bigint()

    const fileContents = fs.readFileSync(this.location, 'utf-8')

    // Try to parse as JSON, fall back to plain text if it fails
    let secretEncryptedObject: any
    try {
      secretEncryptedObject = JSON.parse(fileContents)
    } catch (jsonError) {
      console.log(jsonError)
      // Not JSON, treat as plain text secret
      // Store it as an object with a 'value' key for consistency
      secretEncryptedObject = { value: fileContents.trim() }
    }

    console.log(
      `🔐 Secrets loaded: ${magenta(
        this.location.split('/').slice(-2).join('/')
      )}`
    )

    try {
      // Only decrypt if encryptionKey is provided
      let secrets = secretEncryptedObject
      if (this.encryptionKey) {
        try {
          secrets = Security.decryptObject(
            secretEncryptedObject,
            this.encryptionKey!
          )
        } catch (decryptError: any) {
          console.warn(
            `Failed to decrypt secrets from file: ${decryptError.message}`
          )
          // Fall back to using the raw secrets if decryption fails
          secrets = secretEncryptedObject
        }
      }

      this.setCache(this.location, secrets, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `⏱️ loadSecrets(${this.location}) took ${durationMs.toFixed(3)}ms`
      )
      return secrets as any as SecretType
    } catch (err: unknown) {
      console.error(err)
      throw new Error(`loadSecrets failed to load: ${this.location}`)
    }
  }

  loadSecretsFromGCP(): SecretType {
    // TODO: Implement GCP Secret Manager integration
    // For now, return empty object but apply decryption if needed
    const secrets = {} as any

    if (this.encryptionKey) {
      try {
        return Security.decryptObject(
          secrets,
          this.encryptionKey!
        ) as any as SecretType
      } catch (error: any) {
        console.warn(`Failed to decrypt GCP secrets: ${error.message}`)
      }
    }

    return secrets as SecretType
  }

  loadEncryptionKeyFromGCP(): string {
    return ''
  }

  loadSecretsFromEnv(): SecretType {
    const cacheKey = `env_${this.location}`
    const cached = this.getCache(cacheKey)
    if (cached) {
      return cached as any as SecretType
    }

    const start = process.hrtime.bigint()

    try {
      // For ENV provider, location is used as a prefix for environment variables
      // For example, if location is "APP", it will look for APP_API_KEY, APP_DB_PASSWORD, etc.
      const prefix = this.location ? `${this.location.toUpperCase()}_` : ''
      const secrets: StringMap = {}

      // Get all environment variables that start with the prefix
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          if (prefix && key.startsWith(prefix)) {
            // Remove the prefix from the key
            const secretKey = key.slice(prefix.length)
            secrets[secretKey] = value
          } else if (!prefix) {
            // No prefix, include all environment variables
            secrets[key] = value
          }
        }
      }

      // Log warning if no prefix is specified
      if (!this.location) {
        console.warn(
          'ENV provider without location prefix - this will expose all environment variables'
        )
      }

      // Apply tenant-specific decryption if encryption key is provided
      let decryptedSecrets = secrets
      if (this.encryptionKey) {
        try {
          decryptedSecrets = Security.decryptObject(
            secrets,
            this.encryptionKey!
          )
        } catch (error: any) {
          // If decryption fails, assume secrets are not encrypted
          console.warn(`Failed to decrypt ENV secrets: ${error.message}`)
        }
      }

      this.setCache(cacheKey, decryptedSecrets, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `🔐 Secrets loaded from ENV: ${magenta(
          this.location || 'all'
        )} (${durationMs.toFixed(3)}ms)`
      )

      return decryptedSecrets as any as SecretType
    } catch (error: any) {
      console.error('Failed to load secrets from ENV:', error.message)
      throw new Error(`loadSecretsFromEnv failed: ${error.message}`)
    }
  }

  async loadSecretsFromVault(): Promise<SecretType> {
    if (!this.vaultConfig) {
      throw new Error('Vault configuration is required for VAULT provider')
    }

    // Encryption key is now optional for Vault provider (as of v1.1.4)
    // If provided, secrets will be decrypted; otherwise, raw secrets are returned

    const cacheKey = `vault_${this.vaultConfig.endpoint}_${this.location}`
    const cached = this.getCache(cacheKey)
    if (cached) {
      return cached as any as SecretType
    }

    const start = process.hrtime.bigint()

    try {
      const vaultUrl = `${this.vaultConfig.endpoint}/v1/${
        this.vaultConfig.mount || 'secret'
      }/data/${this.location}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add token authentication
      if (this.vaultConfig.token) {
        headers['X-Vault-Token'] = this.vaultConfig.token
      }

      // Add namespace if specified
      if (this.vaultConfig.namespace) {
        headers['X-Vault-Namespace'] = this.vaultConfig.namespace
      }

      const response = await fetch(vaultUrl, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error(
          `Vault request failed: ${response.status} ${response.statusText}`
        )
      }

      const data = (await response.json()) as any

      // Vault KV v2 stores data in data.data
      let secrets = data.data?.data || data.data || {}

      // Only decrypt if encryptionKey is provided
      if (this.encryptionKey) {
        try {
          secrets = Security.decryptObject(secrets, this.encryptionKey!)
        } catch (error: any) {
          console.warn(`Failed to decrypt Vault secrets: ${error.message}`)
          console.log('Using unencrypted secrets from Vault')
          // Use the raw secrets if decryption fails
          // This allows for both encrypted and unencrypted secrets in Vault
        }
      }

      this.setCache(cacheKey, secrets, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `🔐 Secrets loaded from Vault: ${magenta(
          this.location
        )} (${durationMs.toFixed(3)}ms)`
      )

      return secrets as SecretType
    } catch (error: any) {
      console.error('Failed to load secrets from Vault:', error.message)
      throw new Error(`loadSecretsFromVault failed: ${error.message}`)
    }
  }

  async storeSecretsToVault(secrets: Partial<SecretType>): Promise<void> {
    if (!this.vaultConfig) {
      throw new Error('Vault configuration is required for VAULT provider')
    }

    try {
      const vaultUrl = `${this.vaultConfig.endpoint}/v1/${
        this.vaultConfig.mount || 'secret'
      }/data/${this.location}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add token authentication
      if (this.vaultConfig.token) {
        headers['X-Vault-Token'] = this.vaultConfig.token
      }

      // Add namespace if specified
      if (this.vaultConfig.namespace) {
        headers['X-Vault-Namespace'] = this.vaultConfig.namespace
      }

      // Optionally encrypt secrets before storing in Vault
      let dataToStore = secrets as StringMap
      if (this.encryptionKey) {
        dataToStore = Security.encryptObject(
          secrets as StringMap,
          this.encryptionKey!
        )
      }

      // For Vault KV v2, data needs to be wrapped in a data object
      const payload = {
        data: dataToStore
      }

      const response = await fetch(vaultUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(
          `Vault store request failed: ${response.status} ${response.statusText}`
        )
      }

      // Clear cache to force reload on next access
      const cacheKey = `vault_${this.vaultConfig.endpoint}_${this.location}`
      delete memoryCache[cacheKey]

      console.log(`🔐 Secrets stored to Vault: ${magenta(this.location)}`)
    } catch (error: any) {
      console.error('Failed to store secrets to Vault:', error.message)
      throw new Error(`storeSecretsToVault failed: ${error.message}`)
    }
  }

  loadSecrets(): SecretType | Promise<SecretType> {
    if (this.provider === 'GCP') {
      return this.loadSecretsFromGCP()
    }

    if (this.provider === 'VAULT') {
      return this.loadSecretsFromVault()
    }

    if (this.provider === 'ENV') {
      return this.loadSecretsFromEnv()
    }

    // For FILE provider, return async version by default
    // The synchronous loadSecretsFromFile is still available for backward compatibility
    return this.loadSecretsFromFileAsync()
  }

  loadEncryptionKey() {
    return this.encryptionKey
  }

  async getSecretAsync(secretName: keyof SecretType): Promise<string> {
    const secrets = await this.loadSecrets()
    const secret = secrets[secretName]

    if (!secret) {
      throw new Error(
        `Secret ${secretName.toString()} does not exist in ${this.location} env`
      )
    }

    return secret as string
  }

  async getSecretJsonAsync<T = any>(secretName: keyof SecretType): Promise<T> {
    const secretValue = await this.getSecretAsync(secretName)
    return JSON.parse(secretValue)
  }

  // Keep async versions for backward compatibility
  async getSecret(secretName: keyof SecretType): Promise<string> {
    return this.getSecretAsync(secretName)
  }

  async getSecretJson<T = any>(secretName: keyof SecretType): Promise<T> {
    return this.getSecretJsonAsync(secretName)
  }

  /**
   * Get a secret synchronously (requires preload() to be called first)
   */
  getSecretSync(secretName: keyof SecretType): string {
    if (!this.isPreloaded || !this.preloadedSecrets) {
      throw new Error(
        'Secrets not preloaded. Call preload() before using synchronous methods.'
      )
    }

    const secret = this.preloadedSecrets[secretName]

    if (!secret) {
      throw new Error(
        `Secret ${secretName.toString()} does not exist in ${this.location} env`
      )
    }

    return secret as string
  }

  /**
   * Get a JSON secret synchronously (requires preload() to be called first)
   */
  getSecretJsonSync<T = any>(secretName: keyof SecretType): T {
    const secretValue = this.getSecretSync(secretName)
    return JSON.parse(secretValue)
  }

  // Utility method to clear cache for testing
  static clearCache() {
    Object.keys(memoryCache).forEach(key => {
      delete memoryCache[key]
    })
  }

  // Utility method to clear expired cache entries
  static cleanupExpiredCache() {
    const now = Date.now()
    Object.entries(memoryCache).forEach(([key, entry]) => {
      if (entry?.expiresAt && entry.expiresAt < now) {
        delete memoryCache[key]
      }
    })
  }

  /**
   * Clean up resources (file watchers, etc.) when service is no longer needed
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close()
      this.fileWatcher = undefined
    }
    this.preloadedSecrets = undefined
    this.isPreloaded = false
  }
}
