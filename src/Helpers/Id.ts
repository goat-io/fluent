import { ObjectId } from 'bson'
import { v4 } from 'uuid'
import { nanoid } from 'nanoid'

export const Id = (() => {
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

  const isValidObjectID = (id?: string): boolean => {
    return ObjectId.isValid(id)
  }
  /**
   * Generate a UUID (version 4).
   *
   * @return uuid/v4
   */
  const uuid = (): string => {
    return v4()
  }

  const nanoId = (size : number = 21) : string => nanoid(size)

  return Object.freeze({
    objectID,
    uuid,
    isValidObjectID,
    objectIdString,
    nanoId
  })
})()
