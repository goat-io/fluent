import { getFormDataObject } from './getFormDataObject'

const Form = {
  id: '5d725d15d3d5a3c865b60325',
  type: 'resource',
  tags: [],
  owner: '573cc203e35b990100f16c0a',
  components: [
    {
      autofocus: false,
      input: true,
      tableView: true,
      inputType: 'text',
      inputMask: '',
      label: 'text',
      key: 'text',
      placeholder: '',
      prefix: '',
      suffix: '',
      multiple: false,
      defaultValue: '',
      protected: false,
      unique: true,
      persistent: true,
      hidden: false,
      clearOnHide: true,
      spellcheck: true,
      validate: {
        required: true,
        minLength: 20,
        maxLength: 40,
        pattern: 'regEX',
        custom: '',
        customPrivate: false
      },
      conditional: { show: '', when: null, eq: '' },
      type: 'textfield',
      labelPosition: 'top',
      inputFormat: 'plain',
      tags: [],
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      tableView: true,
      inputType: 'number',
      label: 'number',
      key: 'number',
      placeholder: '',
      prefix: '',
      suffix: '',
      defaultValue: '',
      protected: false,
      persistent: true,
      hidden: false,
      clearOnHide: true,
      validate: {
        required: true,
        min: 2,
        max: 10,
        step: 'any',
        integer: '',
        multiple: '',
        custom: ''
      },
      type: 'number',
      labelPosition: 'top',
      tags: [],
      conditional: { show: '', when: null, eq: '' },
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      inputType: 'checkbox',
      tableView: true,
      label: 'checkbox',
      dataGridLabel: false,
      key: 'checkbox',
      defaultValue: false,
      protected: false,
      persistent: true,
      hidden: false,
      name: '',
      value: '',
      clearOnHide: true,
      validate: { required: true },
      type: 'checkbox',
      labelPosition: 'right',
      hideLabel: false,
      tags: [],
      conditional: { show: '', when: null, eq: '' },
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      tableView: true,
      label: 'selectSingle',
      key: 'selectSingle',
      placeholder: '',
      data: {
        values: [{ value: '', label: '' }],
        json: '',
        url: '',
        resource: '',
        custom: ''
      },
      dataSrc: 'values',
      valueProperty: '',
      defaultValue: '',
      refreshOn: '',
      filter: '',
      authenticate: false,
      template: '<span>{{ item.label }}</span>',
      multiple: false,
      protected: false,
      unique: false,
      persistent: true,
      hidden: false,
      clearOnHide: true,
      validate: { required: false },
      type: 'select',
      labelPosition: 'top',
      tags: [],
      conditional: { show: '', when: null, eq: '' },
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      tableView: true,
      label: 'selectMultiple',
      key: 'selectMultiple',
      placeholder: '',
      data: {
        values: [{ value: '', label: '' }],
        json: '',
        url: '',
        resource: '',
        custom: ''
      },
      dataSrc: 'values',
      valueProperty: '',
      defaultValue: '',
      refreshOn: '',
      filter: '',
      authenticate: false,
      template: '<span>{{ item.label }}</span>',
      multiple: true,
      protected: false,
      unique: false,
      persistent: true,
      hidden: false,
      clearOnHide: true,
      validate: { required: false },
      type: 'select',
      labelPosition: 'top',
      tags: [],
      conditional: { show: '', when: null, eq: '' },
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      tree: true,
      components: [
        {
          autofocus: false,
          input: true,
          tableView: true,
          inputType: 'text',
          inputMask: '',
          label: 'dgtext',
          key: 'datagridDgtext',
          placeholder: '',
          prefix: '',
          suffix: '',
          multiple: false,
          defaultValue: '',
          protected: false,
          unique: false,
          persistent: true,
          hidden: false,
          clearOnHide: true,
          spellcheck: true,
          validate: {
            required: false,
            minLength: '',
            maxLength: '',
            pattern: '',
            custom: '',
            customPrivate: false
          },
          conditional: { show: '', when: null, eq: '' },
          type: 'textfield',
          inDataGrid: true,
          labelPosition: 'top',
          inputFormat: 'plain',
          tags: [],
          properties: {}
        },
        {
          autofocus: false,
          input: true,
          tableView: true,
          inputType: 'number',
          label: 'dgnumber',
          key: 'datagridDgnumber',
          placeholder: '',
          prefix: '',
          suffix: '',
          defaultValue: '',
          protected: false,
          persistent: true,
          hidden: false,
          clearOnHide: true,
          validate: {
            required: false,
            min: '',
            max: '',
            step: 'any',
            integer: '',
            multiple: '',
            custom: ''
          },
          type: 'number',
          inDataGrid: true,
          labelPosition: 'top',
          tags: [],
          conditional: { show: '', when: null, eq: '' },
          properties: {}
        }
      ],
      tableView: true,
      label: 'datagrid',
      key: 'datagrid',
      protected: false,
      persistent: true,
      hidden: false,
      clearOnHide: true,
      type: 'datagrid',
      addAnotherPosition: 'bottom',
      tags: [],
      conditional: { show: '', when: null, eq: '' },
      properties: {}
    },
    {
      autofocus: false,
      input: true,
      label: 'Submit',
      tableView: false,
      key: 'submit',
      size: 'md',
      leftIcon: '',
      rightIcon: '',
      block: false,
      action: 'submit',
      disableOnInvalid: false,
      theme: 'primary',
      type: 'button'
    }
  ],
  revisions: '',
  _vid: 0,
  title: 'FormDataObject',
  display: 'form',
  access: [
    {
      roles: [
        '5ccb6f508fb3ef6c4f96d878',
        '5ccb6f508fb3ef48fb96d879',
        '5ccb6f508fb3efe5f396d87a'
      ],
      type: 'read_all'
    }
  ],
  submissionAccess: [],
  settings: {},
  properties: {},
  name: 'formDataObject',
  path: 'formdataobject',
  project: '5ccb6f508fb3ef72b796d877',
  created: '2019-09-06T13:20:21.299Z',
  modified: '2019-09-06T13:30:10.955Z',
  machineName: 'suopywgtyuabhru:formDataObject'
}

const dataObject = getFormDataObject(Form)

const expectedDataObject = {
  text: { type: 'string', required: true },
  number: { type: 'number', required: true },
  checkbox: { type: 'boolean', required: true },
  selectSingle: { type: 'string', required: false },
  selectMultiple: { type: 'string', array: true, required: false },
  datagrid: {
    datagridDgnumber: { type: 'number', required: false },
    datagridDgtext: { type: 'string', required: false },
    isDatagrid: true
  }
}

it('Should create the DataObject from Form', () => {
  expect(dataObject).toMatchObject(expectedDataObject)
})
