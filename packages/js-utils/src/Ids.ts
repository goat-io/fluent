import { ObjectId } from 'bson'
import { nanoid, customAlphabet } from 'nanoid'
import { v4 as secure } from '@lukeed/uuid/secure'

export const Ids = (() => {
  /**
   *
   */
  const objectID = (id?: string): ObjectId => {
    if (id) {
      return new ObjectId(id)
    }
    return new ObjectId()
  }

  /**
   *
   */
  const objectIdString = (id?: string): string => {
    if (id) {
      return new ObjectId(id).toString()
    }
    return new ObjectId().toString()
  }

  const isValidObjectID = (id?: string): boolean => ObjectId.isValid(id)
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
    objectID,
    uuid,
    isValidObjectID,
    objectIdString,
    nanoId,
    customId
  })
})()
