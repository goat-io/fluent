import Promise from 'bluebird';
const Position = class {
  /**
   * [getConfig description]
   * @return {Object} [description]
   */
  static getConfig () {
    return {
      maximumAge: 3000,
      timeout: 15000,
      enableHighAccuracy: true
    };
  }

  /**
   * [getPosition description]
   * @return {Promise} [description]
   */
  static current () {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(position);
        },
        (error) => {
          reject(error);
        },
        this.getConfig()
      );
    });
  }

  /**
   * [followPosition description]
   * @return {Promise} [description]
   */
  static follow () {
    return new Promise((resolve, reject) => {
      navigator.geolocation.watchPosition(
        (position) => {
          resolve(position);
        },
        (error) => {
          reject(error);
        },
        this.getConfig()
      );
    });
  }
};

export default Position;
