import { nanoid, customAlphabet } from 'nanoid'
import { v4 as secure } from '@lukeed/uuid'

export const Ids = (() => {
  /**
   * Generate a UUID (version 4).
   *
   * @return uuid/v4
   */
  const uuid = (): string => secure()

  const nanoId = (size = 21): string => nanoid(size)

  const customId = (alfabet: string, size = 10) => {
    const nano = customAlphabet(alfabet, size)
    return nano
  }

  return Object.freeze({
    uuid,
    nanoId,
    customId
  })
})()
