let Event = (() => {
  let CustomEvent = function (event, params) {
    var evt = document.createEvent('CustomEvent');

    params = params || { bubbles: false, cancelable: false, detail: undefined };

    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };

  function emit({ name, data, text }) {
    if (!name) throw new Error('Event must have a name.');
    if (!data) throw new Error('Event must have data.');
    if (!text) throw new Error('Event must have a text.');
    let customEvent = CustomEvent(name, {
      detail: {
        data: data,
        text: text
      }
    });

    window.dispatchEvent(customEvent);
  }
  function listen({ name, callback }) {
    if (!name) throw new Error('Listener must have a name.');
    if (!callback) throw new Error('Listener must have a callback.');
    window.addEventListener(name, callback);
  }

  function remove({ name, callback }) {
    if (!name) throw new Error('Listener must have a name to detach');
    if (!callback) throw new Error('Listener must have a callback to detach');
    window.removeEventListener(name, callback);
  }
  return Object.freeze({
    emit,
    listen,
    remove
  });
})();

export default Event;
