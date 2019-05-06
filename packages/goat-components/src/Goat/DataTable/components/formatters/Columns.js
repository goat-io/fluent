import FormioUtils from 'formiojs/utils';
/* eslint-disable */
const Columns = class {
  // eslint-disable
  static get({ form, hasCustomColumn }) {
    const noForm = !!(!form || form.title === '');
    // If there is no Form
    if (noForm) {
      return [{}];
    }
    return Columns.getShow({ form, hasCustomColumn });
  }

  static getShow({ form, hasCustomColumn, vm }) {
    let columns = [];
    // First two Columns for the Table
    /*
    columns.push({
      label: '',
      name: 'status',
      field: 'status',
      width: '45px'
    });
    */
    if (hasCustomColumn) {
      columns.push({
        field: 'custom',
        name: 'custom',
        sort: true,
        width: '45px'
      });
    }
    // If we have a normal table
    const visibleColumns = Columns.getTableView(form);
    columns = columns.concat(Columns.format({ visibleColumns, vm }));

    columns.push({
      label: 'Updated at',
      field: 'HumanUpdated',
      name: 'HumanUpdated',
      filter: true,
      sort: true,
      width: '150px'
    });

    return columns;
  }

  static format({ visibleColumns }) {
    const columns = [];
    // Create the column given the component
    visibleColumns.forEach(column => {
      const visibleColum = {
        label: column.label,
        name: column.key,
        field: column.key,
        filter: true,
        sort: true,
        type: 'string',
        width: '110px'
      };
      columns.push(visibleColum);
    });

    return columns;
  }

  static getTableView(form) {
    return FormioUtils.searchComponents(form.components, {
      input: true,
      tableView: true
    })
      .slice(0, 7)
      .filter(c => !!(c.label !== ''));
  }
};
export default Columns;
