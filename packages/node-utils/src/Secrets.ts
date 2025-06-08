import { StringMap } from '@goatlab/js-utils'
import * as fs from 'fs'
import { Hashes } from './Hashes'
import { Security } from './Security'

let loaded = false
const secretMap: StringMap = {}

class SecretsClass {
  /**
   * Loads plaintext secrets from process.env, removes them, stores locally.
   * Make sure to call this function early on server startup, so secrets are removed from process.env
   *
   * Does NOT delete previous secrets from secretMap.
   */
  loadSecretsFromEnv(): void {
    require('dotenv').config() // ensure .env is loaded

    const secrets: StringMap = {}
    Object.keys(process.env)
      .filter(k => k.toUpperCase().startsWith('SECRET_'))
      .forEach(k => {
        secrets[k.toUpperCase()] = process.env[k]!
        secretMap[k.toUpperCase()] = process.env[k]!
        delete process.env[k]
      })

    loaded = true
    console.log(
      `${
        Object.keys(secrets).length
      } secret(s) loaded from process.env: ${Object.keys(secrets).join(', ')}`
    )
  }

  /**
   * Removes process.env.SECRET_*
   */
  removeSecretsFromEnv(): void {
    Object.keys(process.env)
      .filter(k => k.toUpperCase().startsWith('SECRET_'))
      .forEach(k => delete process.env[k])
  }

  /**
   * Does NOT delete previous secrets from secretMap.
   *
   * If SECRET_ENCRYPTION_KEY argument is passed - will decrypt the contents of the file first, before parsing it as JSON.
   *
   * Whole file is encrypted.
   * For "json-values encrypted" style - use `loadSecretsFromEncryptedJsonFileValues`
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  loadSecretsFromEncryptedJsonFile(
    filePath: string,
    secretEncryptionKey?: string
  ): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `loadSecretsFromEncryptedJsonFile() cannot load from path: ${filePath}`
      )
    }

    let secrets: StringMap

    if (secretEncryptionKey) {
      const buf = fs.readFileSync(filePath)
      const plain = Security.decryptRandomIVBuffer(
        buf,
        secretEncryptionKey
      ).toString('utf8')

      secrets = JSON.parse(plain)
    } else {
      secrets = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }

    Object.entries(secrets).forEach(
      ([k, v]) => (secretMap[k.toUpperCase()] = v)
    )

    loaded = true
    console.log(
      `${
        Object.keys(secrets).length
      } secret(s) loaded from ${filePath}: ${Object.keys(secrets)
        .map(s => s.toUpperCase())
        .join(', ')}`
    )
  }

  /**
   * Whole file is NOT encrypted, but instead individual json values ARE encrypted..
   * For whole-file encryption - use `loadSecretsFromEncryptedJsonFile`
   */
  loadSecretsFromEncryptedJsonFileValues(
    filePath: string,
    secretEncryptionKey?: string
  ): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `loadSecretsFromEncryptedJsonFileValues() cannot load from path: ${filePath}`
      )
    }

    let secrets: StringMap = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    if (secretEncryptionKey) {
      secrets = Security.decryptObject(secrets, secretEncryptionKey)
    }

    Object.entries(secrets).forEach(
      ([k, v]) => (secretMap[k.toUpperCase()] = v)
    )

    loaded = true
    console.log(
      `${
        Object.keys(secrets).length
      } secret(s) loaded from ${filePath}: ${Object.keys(secrets)
        .map(s => s.toUpperCase())
        .join(', ')}`
    )
  }

  requireLoaded(): void {
    if (!loaded) {
      throw new Error(
        `Secrets were not loaded! Call loadSecrets() before accessing secrets.`
      )
    }
  }

  secretOptional<T = string>(k: string, json = false): T | undefined {
    this.requireLoaded()
    const v = secretMap[k.toUpperCase()]
    return v && json ? (JSON.parse(Hashes.base64ToString(v)) as T) : (v as T)
  }

  /**
   * json secrets are always base64'd
   */
  secret<T = string>(k: string, json = false): T {
    const v = this.secretOptional(k, json)
    if (!v) {
      throw new Error(`secret(${k.toUpperCase()}) not found!`)
    }

    return v as any
  }

  /**
   * REPLACES secretMap with new map.
   */
  setSecretMap(map: StringMap): void {
    Object.keys(secretMap).forEach(k => delete secretMap[k])
    Object.entries(map).forEach(([k, v]) => (secretMap[k.toUpperCase()] = v))
    console.log(
      `setSecretMap set ${
        Object.keys(secretMap).length
      } secret(s): ${Object.keys(map)
        .map(s => s.toUpperCase())
        .join(', ')}`
    )
  }
}

export const Secrets = new SecretsClass()
