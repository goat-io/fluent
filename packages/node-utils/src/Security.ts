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

  async generateElipticCurve(): Promise<GeneratedKeyPair> {
    const keys = await new Promise<GeneratedKeyPair>((resolve, reject) => {
      try {
        crypto.generateKeyPair(
          'ed25519',
          {
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem'
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem'
            }
          },
          (error, publicKey, privateKey) => {
            if (error) {
              reject(error)
              return
            }

            resolve({ publicKey, privateKey })
          }
        )
      } catch (error) {
        reject(error)
        return
      }
    })

    return {
      privateKey: keys.privateKey,
      publicKey: keys.publicKey
    }
  }

  /**
   * Encrypts a message using an elliptic curve privateKey
   * Returns a Base64 string with the generated encryption
   * @param message
   * @param privateKey
   * @returns
   */
  encryptStringWithElliptic(message: string, privateKey: string): string {
    const encrypted = crypto.sign(null, Buffer.from(message), privateKey)

    return encrypted.toString('base64')
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
    const verified = crypto.verify(
      null,
      Buffer.from(message),
      publicKey,
      Buffer.from(encryptedMessageBase64, 'base64')
    )

    return verified
  }

  generatePassword(length: number): string {
    const charset =
      charsets.LOWERCASE +
      charsets.UPPERCASE +
      charsets.NUMBERS +
      charsets.SYMBOLS

    const charsetLength = charset.length

    let password = ''

    while (length--) {
      password += charset[crypto.randomInt(charsetLength)]
    }

    return password
  }
}

export const Security = new SecurityClass()
