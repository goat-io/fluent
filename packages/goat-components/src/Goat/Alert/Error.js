import { Notify } from 'quasar';

const Error = (() => {
  const notify = ({ title, text, position }) => {
    Notify.create({
      message: title,
      type: 'negative',
      color: '#f66e84',
      detail: text,
      position: position || 'top-right',
      timeout: 3000,
      closeBtn: 'X'
    });
  };
  return Object.freeze({
    notify
  });
})();
export default Error;
