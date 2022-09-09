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

  saltCompare = async (
    providedPass: string,
    storedPass: string
  ): Promise<boolean> => {
    return await comparer(providedPass, storedPass)
  }

  hash(s: string | Buffer, algorithm: string): string {
    return crypto.createHash(algorithm).update(s).digest('hex')
  }

  md5(s: string | Buffer): string {
    return this.hash(s, 'md5')
  }

  hashAsBuffer(s: string | Buffer, algorithm: string): Buffer {
    return crypto.createHash(algorithm).update(s).digest()
  }

  md5AsBuffer(s: string | Buffer): Buffer {
    return this.hashAsBuffer(s, 'md5')
  }

  stringToBase64(s: string): string {
    return Buffer.from(s, 'utf8').toString('base64')
  }

  base64ToString(strBase64: string): string {
    return Buffer.from(strBase64, 'base64').toString('utf8')
  }

  bufferToBase64(b: Buffer): string {
    return b.toString('base64')
  }

  base64ToBuffer(strBase64: string): Buffer {
    return Buffer.from(strBase64, 'base64')
  }
}

export const Hashes = new HashesClass()
