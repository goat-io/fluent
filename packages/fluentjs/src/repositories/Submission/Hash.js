import { Hash as pHash } from '../../../Helpers/Hash'

const Hash = class {
  static async string(string) {
    const hashed = pHash(string)
    return hashed
  }
}

export default Hash
