import { ObjectID } from 'bson'
import { v4 } from 'uuid'

export const Id = (() => {
  /**
   *
   */
  const objectID = (id?: string | number | ObjectID): string => {
    if (id) {
      return new ObjectID(id).toString()
    }
    return new ObjectID().toString()
  }

  const isValidObjectID = (id?: string | number | ObjectID): boolean => {
    return ObjectID.isValid(id)
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
    isValidObjectID
  })
})()
