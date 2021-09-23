import Utilities from "../utilities";

let Schedule = (() => {
  let _every = 0;
  let every = milliseconds => {
    _every = milliseconds;
    return this;
  };
  let set = async cb => {
    if (_every === 0) {
      throw new Error(
        "You must asign a timeframe. Cannot Schedule every 0 milliseconds. Did you call function every()?"
      );
    }

    let rInterval = function(callback, delay) {
      let dateNow = Date.now,
        requestAnimation =
          typeof window !== "undefined" && window.requestAnimationFrame,
        start = dateNow(),
        stop,
        intervalFunc = function() {
          // eslint-disable-next-line no-use-before-define
          dateNow() - start < delay || ((start += delay), callback());
          // eslint-disable-next-line no-use-before-define
          stop || requestAnimation(intervalFunc);
        };

      requestAnimation(intervalFunc);
      return {
        clear: function() {
          stop = 1;
        }
      };
    };

    var _debouncedCallback = Utilities.debounce(cb, 2000);

    rInterval(_debouncedCallback, milliseconds);
  };

  return Object.freeze({
    set,
    every
  });
})();

export default Schedule;
