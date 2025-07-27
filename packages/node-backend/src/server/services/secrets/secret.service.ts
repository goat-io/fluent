import * as fs from 'fs'
import { fetch } from 'undici'
import type { StringMap } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import { magenta } from 'kleur/colors'

const memoryCache: Record<string, StringMap | undefined> = {}
// type SecretType = typeof secrets

export type SecretProvider = 'GCP' | 'FILE' | 'VAULT' | 'ENV'

export interface VaultConfig {
  endpoint: string
  token?: string
  mount?: string
  namespace?: string
}

export class SecretService<SecretType> {
  provider: SecretProvider
  location: string
  encryptionKey: string
  vaultConfig?: VaultConfig

  constructor({
    provider,
    location,
    encryptionKey,
    vaultConfig
  }: {
    provider: SecretProvider
    location: string
    encryptionKey: string
    vaultConfig?: VaultConfig
  }) {
    this.provider = provider
    this.location = location
    this.encryptionKey = encryptionKey
    this.vaultConfig = vaultConfig
  }
  // We should cache this call
  loadSecretsFromFile(): SecretType {
    if (memoryCache[this.location]) {
      return memoryCache[this.location] as any as SecretType
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
      const decripted = Security.decryptObject(
        secretEncryptedObject,
        this.encryptionKey
      )

      memoryCache[this.location] = decripted

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      console.log(
        `⏱️ loadSecrets(${this.location}) took ${durationMs.toFixed(3)}ms`
      )
      return memoryCache[this.location] as any as SecretType
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
    if (memoryCache[cacheKey]) {
      return memoryCache[cacheKey] as any as SecretType
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

      memoryCache[cacheKey] = secrets

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
    if (memoryCache[cacheKey]) {
      return memoryCache[cacheKey] as any as SecretType
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

      memoryCache[cacheKey] = secrets

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

    return this.loadSecretsFromFile()
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

    const secrets = this.loadSecrets() as SecretType
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
}
