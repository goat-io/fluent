import { StringMap, stringMapEntries } from '@goatlab/js-utils'
import * as crypto from 'crypto'
import { Hashes } from './Hashes'

const defaultAlgorithm = 'aes-256-cbc'

const charsets = {
  NUMBERS: '0123456789',
  LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
  UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  SYMBOLS: '!#$%&()+,-.<=>?@^_'
}

export interface GeneratedKeyPair {
  publicKey: string
  privateKey: string
}
class SecurityClass {
  /**
   * Generates cryptographic parameters (key and IV) from a secret key
   * @param secretKey The secret key to derive parameters from
   * @returns Object containing the derived key and initialization vector
   */
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

  /**
   * Encrypts all values in a StringMap object using AES-256-CBC
   * @param obj Object with string values to encrypt
   * @param secretKey Secret key for encryption
   * @returns Object with encrypted values
   */
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

    return Object.fromEntries(
      stringMapEntries(obj).map(([k, v]) => {
        const decipher = crypto.createDecipheriv(defaultAlgorithm, key, iv)
        return [
          k,
          decipher.update(v, 'base64', 'utf8') + decipher.final('utf8')
        ]
      })
    )
  }

  /**
   * Encrypts a buffer using AES-256-CBC with a random IV for non-deterministic encryption
   * The IV is prepended to the encrypted data for later decryption
   * @param input Buffer to encrypt
   * @param secretKeyBase64 Base64 encoded secret key
   * @returns Buffer containing IV + encrypted data
   */
  encryptRandomIVBuffer(input: Buffer, secretKeyBase64: string): Buffer {
    // md5 to match aes-256 key length of 32 bytes
    const key = Hashes.md5(Buffer.from(secretKeyBase64, 'base64'))

    // Random iv to achieve non-deterministic encryption (but deterministic decryption)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(defaultAlgorithm, key, iv)

    return Buffer.concat([iv, cipher.update(input), cipher.final()])
  }

  /**
   * Decrypts a buffer that was encrypted with encryptRandomIVBuffer
   * Extracts the IV from the first 16 bytes and uses it to decrypt the remaining data
   * @param input Buffer containing IV + encrypted data
   * @param secretKeyBase64 Base64 encoded secret key
   * @returns Decrypted buffer
   */
  decryptRandomIVBuffer(input: Buffer, secretKeyBase64: string): Buffer {
    const key = Hashes.md5(Buffer.from(secretKeyBase64, 'base64'))
    const decipher = crypto.createDecipheriv(
      defaultAlgorithm,
      key,
      input.subarray(0, 16)
    )

    return Buffer.concat([
      decipher.update(input.subarray(16)),
      decipher.final()
    ])
  }

  /**
   * Generates an Ed25519 elliptic curve key pair
   * @returns Promise resolving to an object containing PEM-formatted public and private keys
   */
  async generateElipticCurve(): Promise<GeneratedKeyPair> {
    const { promisify } = require('util')
    const generateKeyPairAsync = promisify(crypto.generateKeyPair)

    return await generateKeyPairAsync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })
  }

  /**
   * Encrypts a message using an elliptic curve privateKey
   * Returns a Base64 string with the generated encryption
   * @param message
   * @param privateKey
   * @returns
   */
  encryptStringWithElliptic(message: string, privateKey: string): string {
    return crypto
      .sign(null, Buffer.from(message), privateKey)
      .toString('base64')
  }

  /**
   * Verifies if the message is equivalent to the encryptedBase64
   * using an Elliptic Public Key
   * @param message String
   * @param encryptedMessageBase64 Elliptic key encrypted Base64
   * @param publicKey Elliptic Public Key
   * @returns
   */
  verifySignedStringWithElliptic(
    message: string,
    encryptedMessageBase64: string,
    publicKey: string
  ): boolean {
    return crypto.verify(
      null,
      Buffer.from(message),
      publicKey,
      Buffer.from(encryptedMessageBase64, 'base64')
    )
  }

  /**
   * Generates a random password with specified length
   * Uses lowercase, uppercase, numbers, and symbols character sets
   * @param length Desired password length
   * @returns Generated password string
   */
  generatePassword(length: number): string {
    const charset =
      charsets.LOWERCASE +
      charsets.UPPERCASE +
      charsets.NUMBERS +
      charsets.SYMBOLS

    const bytes = crypto.randomBytes(length)
    let password = ''

    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length]
    }

    return password
  }
}

export const Security = new SecurityClass()
