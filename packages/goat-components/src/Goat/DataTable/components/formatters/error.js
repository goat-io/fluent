import FormioUtils from 'formiojs/utils';

const ErrorFormatter = (() => {
  function format({ errors, vm }) {
    let errorString = `<div style="overflow-x:auto;"><table class="restable"><thead> <tr><th scope="col">${vm.$t(
      'Field label'
    )}</th><th scope="col">${vm.$t('Error')}</th></thead><tbody>`;

    if (errors && errors.details) {
      errors.details.forEach(detail => {
        const components = vm.currentForm.data
          ? vm.currentForm.data.components
          : vm.currentForm.components;
        const component = FormioUtils.getComponent(components, detail.path[0]);
        const label = component ? vm.$t(component.label) : '';
        errorString += '<tr>';
        errorString = `${errorString}<td data-label=${vm.$t('Field label')}>${label}</td>`;
        errorString = `${errorString}<td data-label=${vm.$t('Error')}>${detail.message}</td>`;
        errorString += '</tr>';
      });
    }
    errorString += '</tbody></table></div>';

    return errorString;
  }
  return Object.freeze({
    format
  });
})();
export default ErrorFormatter;
