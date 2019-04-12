import md5 from 'md5';
import Configuration from '../../models/Configuration';

let Hash = class {
  static async string (string) {
    let config = await Configuration.local().first();
    let hashed = '';

    hashed = md5(string, config.MD5_KEY);
    return hashed;
  }
};

export default Hash;
