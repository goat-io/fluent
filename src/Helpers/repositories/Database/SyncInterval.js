import Sync from './Sync';
import Utilities from 'utilities';

let SyncInterval = (() => {
  async function set (milliseconds) {
    let rInterval = function (callback, delay) {
      let dateNow = Date.now,
        requestAnimation = (typeof window !== 'undefined') && window.requestAnimationFrame,
        start = dateNow(),
        stop,
        intervalFunc = function () {
          // eslint-disable-next-line no-use-before-define
          dateNow() - start < delay || ((start += delay), callback());
          // eslint-disable-next-line no-use-before-define
          stop || requestAnimation(intervalFunc);
        };

      requestAnimation(intervalFunc);
      return {
        clear: function () {
          stop = 1;
        }
      };
    };

    var _debouncedSync = Utilities.debounce(Sync.now, 2000);

    rInterval(_debouncedSync, milliseconds);
  }

  return Object.freeze({
    set
  });
})();

export default SyncInterval;
