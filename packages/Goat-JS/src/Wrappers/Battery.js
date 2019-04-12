import Promise from 'bluebird';
const Battery = class {
  /**
   * [status description]
   * @return {Promise} [description]
   */
  static status () {
    return new Promise((resolve, reject) => {
      window.addEventListener(
        'batterystatus',
        (status) => {
          resolve(status);
        },
        false
      );
    });
  }

  /**
   * [isLow description]
   * @return {Promise} [description]
   */
  static isLow () {
    return new Promise((resolve, reject) => {
      window.addEventListener(
        'batterylow',
        (status) => {
          resolve(status);
        },
        false
      );
    });
  }

  /**
   * [isCritical description]
   * @return {Promise} [description]
   */
  static isCritical () {
    return new Promise((resolve, reject) => {
      window.addEventListener(
        'batterycritical',
        (status) => {
          resolve(status);
        },
        false
      );
    });
  }
};

export default Battery;
