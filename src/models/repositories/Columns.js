import Utilities from 'utilities';
import Form from '../Form';

let Columns = class {
  static async getTableView(path) {
    const form = (await Form.local()
      .where('data.path', '=', path)
      .first()).data;

    return Utilities.findComponents(form.components, {
      input: true,
      tableView: true
    }).filter(c => {
      return !!(c.label !== '');
    });
  }
};

export default Columns;
