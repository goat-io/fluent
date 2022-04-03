import { compare as comparer, genSalt, hash as hasher } from 'bcryptjs'

export const Hashes = (() => {
  /**
   * It takes in a plain password, generates a salt with given
   * round and returns the hashed password as a string
   * @param password
   * @param rounds
   */
  const hash = async (password: string, rounds?: number): Promise<string> => {
    const salt = await genSalt(rounds)
    return hasher(password, salt)
  }

  /**
   *
   * @param providedPass
   * @param storedPass
   */
  const compare = async (
    providedPass: string,
    storedPass: string
  ): Promise<boolean> => {
    const passwordMatches = await comparer(providedPass, storedPass)
    return passwordMatches
  }
  return Object.freeze({ hash, compare })
})()
