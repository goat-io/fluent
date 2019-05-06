import Swal from 'sweetalert2';

const Question = (() => {
  const confirm = ({ title, text, confirmText, cancelText, onConfirm }) => {
    Swal({
      title,
      text,
      type: 'warning',
      showCancelButton: true,
      confirmButtonClass: 'g-swal-confirm',
      cancelButtonClass: 'g-swal-cancel',
      confirmButtonText: confirmText || 'OK',
      cancelButtonText: cancelText || 'Cancel'
    })
      .then(async result => {
        if (!result.value) {
          return;
        }
        // Handle when pressing  cancel
        onConfirm();
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.log('Unexpected error', error);
      });
  };
  return Object.freeze({
    confirm
  });
})();
export default Question;
