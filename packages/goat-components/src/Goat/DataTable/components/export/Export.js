import Promise from 'bluebird';
import Download from 'fast-downloads';
import AnyExporter from 'fast-submission2any';
import FormioExport from 'formio-export';
import { Translation } from '@goatlab/goatjs';
import _mapValues from 'lodash/mapValues';
import Language from '../../../../helpers/language';
/* eslint-disable */
const Export = class {
  /**
   *
   * @param {*} param0
   */
  static async jsonTo({ fileName, output, data, formioForm }) {
    const translations = await Export.getTranslations();
    const language = Language.get();
    let mimeType;
    let exportedFile;
    if (output !== 'pdf-form') {
      exportedFile = await AnyExporter.to({
        output,
        data,
        formioForm,
        translations,
        language
      });
    }

    return new Promise(async resolve => {
      switch (output.toLowerCase()) {
        case 'csv':
          mimeType = 'text/csv;encoding:utf-8';
          break;
        case 'json':
          mimeType = 'text/json;encoding:utf-8';
          break;
        case 'xlsx-form':
        case 'pdf-form':
          const submission = {
            _id: data[0]._id,
            data: data[0],
            owner: data[0].owner ? data[0].owner : '',
            modified: ''
          };

          const exporter = new FormioExport(formioForm, submission, {
            filename: `${fileName}.pdf`
          });

          const pdf = await exporter.toPdf();
          exportedFile = pdf.output('arraybuffer');
          mimeType = 'application/pdf;encoding:utf-8';
          break;
        default:
          mimeType =
            output === 'xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'application/octet-stream';
          break;
      }
      output = output === 'pdf-form' ? 'pdf' : output;

      const download = await Download.file({
        content: exportedFile,
        fileName: `${fileName}.${output}`,
        mimeType
      });
      if (download) {
        resolve();
      }
    });
  }

  static async getTranslations() {
    let localTranslations = await Translation.local().first();
    localTranslations = localTranslations.data ? localTranslations.data : {};
    localTranslations = _mapValues(localTranslations, language => {
      const a = language;
      language = {};
      language.translation = a;
      return language;
    });

    return localTranslations;
  }
};
export default Export;
