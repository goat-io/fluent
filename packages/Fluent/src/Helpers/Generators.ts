import { ObjectID } from 'bson'
const uuidv4 = require('uuid/v4')

export const Generators = () => {
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
    return uuidv4()
  }

  return Object.freeze({
    objectID,
    uuid
  })
}
