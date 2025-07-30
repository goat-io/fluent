// import offlinePlugin from 'offlinePlugin/offlinePlugin';
import Submission from '../../models/Submission'
import Event from '../../Wrappers/Event'

const Import = class {
  /**
   *
   * @param {*} file
   * @param {*} vm
   */
  static fromJsonFile(file, vm) {
    const reader = new FileReader()
    // Closure to capture the file information.

    reader.onload = (_theFile => e => {
      let json

      try {
        json = JSON.parse(e.target.result)
      } catch (_ex) {
        throw new Error('The Json file could not be parsed')
      }
      Import.parseJson(json, vm)
    })(file)
    reader.readAsText(file)
  }
  /**
   *
   * @param {*} json
   * @param {*} vm
   */
  static async parseJson(json, vm) {
    // let totalSubmissions = json.length;
    const formio = Import.getFormIOInstance(vm)

    // Loading.show({ message: 'Importing ' + totalSubmissions + ' submissions' });
    // json = json.slice(151, 200);

    Promise.each(json, async (row, _index) => {
      // await Uploader.sendDataToFormIO(row)
      const submission = Import.prepareSubmission(row)

      await Import.saveSubmission(submission, formio, vm)
    })
      .then(() => {
        Event.emit({
          name: 'FAST:DATA:IMPORTED',
          data: { imported: true },
          text: 'Data was imported'
        })
      })
      .catch(error => {
        // Loading.hide(error);
        console.log(error)
        vm.$swal(
          vm.$t('Import Error!'),
          vm.$t(
            'Your submission could not be Imported. Please check the format of your Json file.'
          ),
          'error'
        )
      })
  }

  static emitNotification(vm) {
    vm.$eventHub.emit('FAST-DATA_IMPORTED')
  }
  /**
   *
   * @param {*} row
   */
  static prepareSubmission(row) {
    if (row.id || row._id) {
      row.id = undefined
      row._id = undefined
    }
    if (row.modified) {
      row.modified = undefined
    }
    if (row.owner) {
      row.owner = undefined
    }
    const data = row.data ? row.data : row
    const formSubmission = {
      data: data,
      redirect: false,
      syncError: false,
      draft: true,
      trigger: 'importSubmission'
    }

    return formSubmission
  }
  /**
   *
   * @param {*} vm
   */
  /*
  static getFormIOInstance (vm) {
    Formio.deregisterPlugin('offline');
    Formio.registerPlugin(offlinePlugin.getPlugin(vm.form.data.path, undefined, false), 'offline');
    let APP_URL = vm.$FAST_CONFIG.APP_URL;
    let formUrl = APP_URL + '/' + vm.form.data.path;
    let formio = new Formio(formUrl);

    return formio;
  }
*/
  /**
   *
   * @param {*} vm
   */
  static async saveSubmission(submission, formio, _vm) {
    // let processedSubmission = PreProcess.JsonSubmission(submission);

    await Submission('*').add({ submission: submission, formio: formio })
  }
}

export default Import
