import { Formio } from './Formio'
const form = {
  id: '5d725d15d3d5a3c865b60325',
  type: 'resource',
  components: [
    {
      autofocus: false,
      input: true,
      tableView: true,
      inputType: 'text',
      inputMask: '',
      label: 'name',
      key: 'name',
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
      conditional: {
        show: '',
        when: null,
        eq: ''
      },
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
      label: 'age',
      key: 'age',
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
      labelPosition: 'top',
      tags: [],
      conditional: {
        show: '',
        when: null,
        eq: ''
      },
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
  title: 'Goats',
  display: 'form',
  name: 'goats',
  path: 'goats'
}

it('eachComponent - Should iterate over all available components', () => {
  const keys: string[] = []
  Formio.eachComponent(form.components, component => {
    // Do something with the component
    keys.push(component.key)
  })
  expect(keys[0]).toBe('name')
})

it('findComponents - Should find a specific component', () => {
  const components = Formio.findComponents(form.components, {
    type: 'textfield',
    key: 'name'
  })

  expect(components[0].label).toBe('name')
})

it('flattenComponent - Should flatten the components', () => {
  const components = Formio.flattenComponents(form.components)
  expect(components.name.inputType).toBe('text')
})

it('getter - Should transform from string to component', () => {
  const stringyFiedForm = { ...form, ...{ components: JSON.stringify(form) } }
  const parsedForm = Formio.getter(stringyFiedForm)
  expect(typeof parsedForm.components).toBe('object')
})

it('setter - Should transform from component to string', () => {
  const parsedForm = Formio.setter(form)
  expect(typeof parsedForm.components).toBe('string')
})

it('labels - Should extract all existing labels', () => {
  const parsedForm = Formio.labels([form])
  expect(parsedForm.name.location[0].text).toBe('name')
})

it('tableViewComponents - Should get the tableViewComponent', () => {
  const tableView = Formio.tableViewComponents(form)
  expect(tableView.length).toBe(2)
  expect(tableView[0].key).toBe('name')
})

it('tableViewComponents - Should get the tableViewComponent', () => {
  const tableView = Formio.tableViewLabels(form)
  expect(tableView.length).toBe(5)
  expect(tableView[0]).toBe('name')
})
