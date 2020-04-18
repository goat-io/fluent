import { ObjectID } from 'bson'
import { v4 } from 'uuid'

export const Id = (() => {
  /**
   *
   */
  const objectID = (): string => {
    return new ObjectID().toString()
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
    uuid
  })
})()
