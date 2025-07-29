import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import { fetch } from 'undici'
import type { StringMap } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import { magenta } from 'kleur/colors'

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
  encryptionKey: string
  vaultConfig?: VaultConfig
  cacheTTL?: number // TTL in milliseconds
}

export class SecretService<SecretType> {
  provider: SecretProvider
  location: string
  encryptionKey: string
  vaultConfig?: VaultConfig
  cacheTTL: number

  constructor(config: SecretServiceConfig) {
    this.provider = config.provider
    this.location = config.location
    this.encryptionKey = config.encryptionKey
    this.vaultConfig = config.vaultConfig
    this.cacheTTL = config.cacheTTL ?? DEFAULT_TTL_MS
  }

  // Helper method to check if cache entry is valid
  private isCacheValid(entry: CacheEntry<StringMap> | undefined): boolean {
    if (!entry) return false
    if (!entry.expiresAt) return true // No expiration set
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
    } catch (error) {
      throw new Error(`Secret file "${this.location}" does not exist`)
    }

    try {
      const fileContents = await fsPromises.readFile(this.location, 'utf-8')
      const secretEncryptedObject = JSON.parse(fileContents)

      console.log(
        `🔐 Secrets loaded: ${magenta(
          this.location.split('/').slice(-2).join('/')
        )}`
      )

      const decrypted = Security.decryptObject(
        secretEncryptedObject,
        this.encryptionKey
      )

      this.setCache(this.location, decrypted, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `⏱️ loadSecrets(${this.location}) took ${durationMs.toFixed(3)}ms`
      )
      return decrypted as any as SecretType
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON in secret file: ${this.location}`)
      }
      console.error(err)
      throw new Error(`loadSecrets failed to decrypt: ${this.location}`)
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
    const secretEncryptedObject = JSON.parse(fileContents)

    console.log(
      `🔐 Secrets loaded: ${magenta(
        this.location.split('/').slice(-2).join('/')
      )}`
    )

    try {
      const decrypted = Security.decryptObject(
        secretEncryptedObject,
        this.encryptionKey
      )

      this.setCache(this.location, decrypted, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `⏱️ loadSecrets(${this.location}) took ${durationMs.toFixed(3)}ms`
      )
      return decrypted as any as SecretType
    } catch (err: unknown) {
      console.error(err)
      throw new Error(`loadSecrets failed to decrypt: ${this.location}`)
    }
  }

  loadSecretsFromGCP(): SecretType {
    return {} as SecretType
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

      this.setCache(cacheKey, secrets, this.cacheTTL)

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `🔐 Secrets loaded from ENV: ${magenta(
          this.location || 'all'
        )} (${durationMs.toFixed(3)}ms)`
      )

      return secrets as any as SecretType
    } catch (error: any) {
      console.error('Failed to load secrets from ENV:', error.message)
      throw new Error(`loadSecretsFromEnv failed: ${error.message}`)
    }
  }

  async loadSecretsFromVault(): Promise<SecretType> {
    if (!this.vaultConfig) {
      throw new Error('Vault configuration is required for VAULT provider')
    }

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
      const secrets = data.data?.data || data.data || {}

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

      // For Vault KV v2, data needs to be wrapped in a data object
      const payload = {
        data: secrets
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

  async getSecret(secretName: keyof SecretType): Promise<string> {
    const secrets = await this.loadSecrets()
    const secret = secrets[secretName]

    if (!secret) {
      throw new Error(
        `Secret ${secretName.toString()} does not exist in ${this.location} env`
      )
    }

    return secret as string
  }

  async getSecretJson<T = any>(secretName: keyof SecretType): Promise<T> {
    const secretValue = await this.getSecret(secretName)
    return JSON.parse(secretValue)
  }

  // Synchronous versions for backward compatibility (FILE and ENV providers only)
  getSecretSync(secretName: keyof SecretType): string {
    if (this.provider === 'VAULT') {
      throw new Error('Use async getSecret() method for Vault provider')
    }

    // Use synchronous loaders for sync methods
    let secrets: SecretType
    if (this.provider === 'FILE') {
      secrets = this.loadSecretsFromFile()
    } else if (this.provider === 'ENV') {
      secrets = this.loadSecretsFromEnv()
    } else {
      secrets = this.loadSecretsFromGCP()
    }
    
    const secret = secrets[secretName]

    if (!secret) {
      throw new Error(
        `Secret ${secretName.toString()} does not exist in ${this.location} env`
      )
    }

    return secret as string
  }

  getSecretJsonSync<T = any>(secretName: keyof SecretType): T {
    return JSON.parse(this.getSecretSync(secretName))
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
}
