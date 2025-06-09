import { compare as comparer, genSalt, hash as hasher } from 'bcrypt'
import * as crypto from 'crypto'

class HashesClass {
  /**
   * It takes in a plain password, generates a salt with given
   * round and returns the hashed password as a string
   * @param password
   * @param rounds
   */
  saltHash = async (password: string, rounds?: number): Promise<string> => {
    const salt = await genSalt(rounds)
    return await hasher(password, salt)
  }

  /**
   * Compares a plain text password with a hashed password
   * @param providedPass - The plain text password to verify
   * @param storedPass - The hashed password to compare against
   * @returns Promise that resolves to true if passwords match, false otherwise
   */
  saltCompare = async (
    providedPass: string,
    storedPass: string
  ): Promise<boolean> => {
    return await comparer(providedPass, storedPass)
  }

  /**
   * Creates a hash of the input using the specified algorithm
   * @param s - The string or buffer to hash
   * @param algorithm - The hashing algorithm to use
   * @returns The hash as a hexadecimal string
   */
  hash(s: string | Buffer, algorithm: string): string {
    return crypto.createHash(algorithm).update(s).digest('hex')
  }

  /**
   * Creates an MD5 hash of the input
   * @param s - The string or buffer to hash
   * @returns The MD5 hash as a hexadecimal string
   */
  md5(s: string | Buffer): string {
    return this.hash(s, 'md5')
  }

  /**
   * Creates a hash of the input using the specified algorithm and returns as Buffer
   * @param s - The string or buffer to hash
   * @param algorithm - The hashing algorithm to use
   * @returns The hash as a Buffer
   */
  hashAsBuffer(s: string | Buffer, algorithm: string): Buffer {
    return crypto.createHash(algorithm).update(s).digest()
  }

  /**
   * Creates an MD5 hash of the input and returns as Buffer
   * @param s - The string or buffer to hash
   * @returns The MD5 hash as a Buffer
   */
  md5AsBuffer(s: string | Buffer): Buffer {
    return this.hashAsBuffer(s, 'md5')
  }

  /**
   * Converts a UTF-8 string to Base64 encoding
   * @param s - The string to encode
   * @returns The Base64 encoded string
   */
  stringToBase64(s: string): string {
    return Buffer.from(s, 'utf8').toString('base64')
  }

  /**
   * Converts a Base64 encoded string back to UTF-8
   * @param strBase64 - The Base64 encoded string to decode
   * @returns The decoded UTF-8 string
   */
  base64ToString(strBase64: string): string {
    return Buffer.from(strBase64, 'base64').toString('utf8')
  }

  /**
   * Converts a Buffer to Base64 string
   * @param b - The Buffer to convert
   * @returns The Base64 encoded string
   */
  bufferToBase64(b: Buffer): string {
    return b.toString('base64')
  }

  /**
   * Converts a Base64 string to Buffer
   * @param strBase64 - The Base64 encoded string to convert
   * @returns The decoded Buffer
   */
  base64ToBuffer(strBase64: string): Buffer {
    return Buffer.from(strBase64, 'base64')
  }
}

export const Hashes = new HashesClass()
