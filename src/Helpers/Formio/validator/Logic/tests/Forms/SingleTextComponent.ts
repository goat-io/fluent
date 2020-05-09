// This is just  a simple text component
export const textForm = (() => {
  return {
    _id: '5d24e91176853baf2b663a60',
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
        label: 'Text',
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
          minLength: 5,
          maxLength: 10,
          pattern: '',
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
    title: 'test',
    display: 'form',
    access: [
      {
        roles: ['5c069517f137d96a8e76ce7b', '5c069517f137d953c476ce7c', '5c069517f137d9542f76ce7d'],
        type: 'read_all'
      }
    ],
    submissionAccess: [],
    settings: {},
    properties: {},
    name: 'test',
    path: 'test',
    project: '5c069516f137d9410176ce7a',
    created: '2019-07-09T19:20:49.908Z',
    modified: '2019-07-09T20:20:00.421Z',
    machineName: 'salsodtztlfxtzh:test'
  }
})()
