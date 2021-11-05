import { Hash as pHash } from '../../../Helpers/Hash'

let Hash = class {
  static async string(string) {
    hashed = pHash(string)
  }
}

export default Hash
