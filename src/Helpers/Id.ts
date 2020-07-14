// import ObjectId from 'bson-objectid'
// import { ObjectId } from 'mongodb'
import { ObjectId } from 'bson'
import { v4 } from 'uuid'

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

  return Object.freeze({
    objectID,
    uuid,
    isValidObjectID,
    objectIdString
  })
})()
