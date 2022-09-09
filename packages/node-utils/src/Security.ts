import { StringMap, stringMapEntries } from '@goatlab/js-utils'
import * as crypto from 'crypto'
import { Hashes } from './Hashes'

const defaultAlgorithm = 'aes-256-cbc'
class SecurityClass {
  getCryptoParams(secretKey: string): { key: string; iv: string } {
    const key = Hashes.md5(secretKey)
    const iv = Hashes.md5(secretKey + key).slice(0, 16)
    return { key, iv }
  }
  /**
   * Using aes-256-cbc
   */
  encryptString(str: string, secretKey: string): string {
    const { key, iv } = this.getCryptoParams(secretKey)
    const cipher = crypto.createCipheriv(defaultAlgorithm, key, iv)
    return cipher.update(str, 'utf8', 'base64') + cipher.final('base64')
  }

  /**
   * Using aes-256-cbc
   */
  decryptString(str: string, secretKey: string): string {
    const { key, iv } = this.getCryptoParams(secretKey)
    const decipher = crypto.createDecipheriv(defaultAlgorithm, key, iv)
    return decipher.update(str, 'base64', 'utf8') + decipher.final('utf8')
  }

  encryptObject(obj: StringMap, secretKey: string): StringMap {
    const { key, iv } = this.getCryptoParams(secretKey)

    const r: StringMap = {}
    stringMapEntries(obj).forEach(([k, v]) => {
      const cipher = crypto.createCipheriv(defaultAlgorithm, key, iv)
      r[k] = cipher.update(v, 'utf8', 'base64') + cipher.final('base64')
    })
    return r
  }

  /**
   * Decrypts all object values.
   * Returns object with decrypted values.
   */
  decryptObject(obj: StringMap, secretKey: string): StringMap {
    const { key, iv } = this.getCryptoParams(secretKey)

    const r: StringMap = {}
    stringMapEntries(obj).forEach(([k, v]) => {
      const decipher = crypto.createDecipheriv(defaultAlgorithm, key, iv)
      r[k] = decipher.update(v, 'base64', 'utf8') + decipher.final('utf8')
    })
    return r
  }

  encryptRandomIVBuffer(input: Buffer, secretKeyBase64: string): Buffer {
    // md5 to match aes-256 key length of 32 bytes
    const key = Hashes.md5(Buffer.from(secretKeyBase64, 'base64'))

    // Random iv to achieve non-deterministic encryption (but deterministic decryption)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(defaultAlgorithm, key, iv)

    return Buffer.concat([iv, cipher.update(input), cipher.final()])
  }

  decryptRandomIVBuffer(input: Buffer, secretKeyBase64: string): Buffer {
    // md5 to match aes-256 key length of 32 bytes
    const key = Hashes.md5(Buffer.from(secretKeyBase64, 'base64'))

    // iv is first 16 bytes of encrypted buffer, the rest is payload
    const iv = input.slice(0, 16)
    const payload = input.slice(16)

    const decipher = crypto.createDecipheriv(defaultAlgorithm, key, iv)

    return Buffer.concat([decipher.update(payload), decipher.final()])
  }
}

export const Security = new SecurityClass()
