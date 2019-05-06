import { Notify } from 'quasar';

const Positive = (() => {
  const notify = ({ title, text, position }) => {
    Notify.create({
      message: title,
      type: 'positive',
      color: 'positive',
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
export default Positive;
