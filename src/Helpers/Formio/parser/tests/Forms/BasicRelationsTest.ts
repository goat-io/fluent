import {FormioForm} from "../../../types/FormioForm"

export const BasicForms: FormioForm[] = ((): FormioForm[] => {
  return [
           {
             _id: '5cf99eb190d44a00189ab94f',
             type: 'resource',
             tags: ['common'],
             deleted: null,
             owner: '5cf99e0590d44a00189ab94d',
             components: [
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Code',
                 key: 'code',
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
                 properties: {
                   search: 'text'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Name',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 inputType: 'text',
                 inputMask: '',
                 label: 'ngram',
                 key: '_ngram',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: true,
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
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tree: true,
                 components: [
                   {
                     input: true,
                     tree: true,
                     components: [
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'new',
                         key: 'new',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'previous',
                         key: 'previous',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'timestamp',
                         key: 'timestamp',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'user',
                         key: 'user',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'kind',
                         key: 'kind',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'path',
                         key: 'path',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: true,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       }
                     ],
                     multiple: false,
                     tableView: false,
                     label: 'changes',
                     key: 'changes',
                     protected: false,
                     persistent: true,
                     hidden: false,
                     clearOnHide: true,
                     templates: {
                       header:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ component.label }} \n    </div> \n  {% }) %} \n</div>',
                       row:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ getView(component, row[component.key]) }} \n    </div> \n  {% }) %} \n  <div class="col-sm-2"> \n    <div class="btn-group pull-right"> \n      <div class="btn btn-default editRow">Edit</div> \n      <div class="btn btn-danger removeRow">Delete</div> \n    </div> \n  </div> \n</div>',
                       footer: ''
                     },
                     type: 'editgrid',
                     inDataGrid: true,
                     tags: [],
                     conditional: {
                       show: '',
                       when: null,
                       eq: ''
                     },
                     properties: {},
                     lockKey: true
                   }
                 ],
                 tableView: false,
                 label: 'History',
                 key: 'history',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 clearOnHide: true,
                 type: 'datagrid',
                 addAnotherPosition: 'bottom',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true,
                 source: '5cf9bbef90d44a00189ab958'
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
             display: 'form',
             submissionAccess: [
               {
                 roles: [],
                 type: 'create_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'read_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'update_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'delete_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93b'],
                 type: 'create_own'
               },
               {
                 roles: [],
                 type: 'read_own'
               },
               {
                 roles: [],
                 type: 'update_own'
               },
               {
                 roles: [],
                 type: 'delete_own'
               }
             ],
             title: 'Countries',
             name: 'countries',
             path: 'countries',
             access: [
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93d'],
                 type: 'read_all'
               }
             ],
             created: '2019-06-06T23:16:01.080+0000',
             modified: '2019-06-24T21:45:50.979+0000',
             machineName: 'countries'
           },
           {
             _id: '5cf9bbef90d44a00189ab958',
             type: 'resource',
             tags: ['common'],
             deleted: null,
             owner: '5cf99e0590d44a00189ab94d',
             components: [
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 label: 'Country',
                 key: 'country',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '5cf99eb190d44a00189ab94f',
                   custom: ''
                 },
                 dataSrc: 'resource',
                 valueProperty: '_id',
                 defaultValue: '',
                 refreshOn: '',
                 filter: '',
                 authenticate: false,
                 template: '<span>{{ item.data.name }}</span>',
                 multiple: false,
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: false,
                 clearOnHide: true,
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 searchField: '_id__regex',
                 reference: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 inputType: 'text',
                 inputMask: '',
                 label: 't_id',
                 key: 'tId',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: true,
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
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Code',
                 key: 'code',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Name',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tree: true,
                 components: [
                   {
                     input: true,
                     tree: true,
                     components: [
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'new',
                         key: 'new',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'previous',
                         key: 'previous',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'timestamp',
                         key: 'timestamp',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'user',
                         key: 'user',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'kind',
                         key: 'kind',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'path',
                         key: 'path',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: true,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       }
                     ],
                     multiple: false,
                     tableView: false,
                     label: 'changes',
                     key: 'changes',
                     protected: false,
                     persistent: true,
                     hidden: false,
                     clearOnHide: true,
                     templates: {
                       header:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ component.label }} \n    </div> \n  {% }) %} \n</div>',
                       row:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ getView(component, row[component.key]) }} \n    </div> \n  {% }) %} \n  <div class="col-sm-2"> \n    <div class="btn-group pull-right"> \n      <div class="btn btn-default editRow">Edit</div> \n      <div class="btn btn-danger removeRow">Delete</div> \n    </div> \n  </div> \n</div>',
                       footer: ''
                     },
                     type: 'editgrid',
                     inDataGrid: true,
                     tags: [],
                     conditional: {
                       show: '',
                       when: null,
                       eq: ''
                     },
                     properties: {},
                     lockKey: true
                   }
                 ],
                 tableView: false,
                 label: 'History',
                 key: 'history',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 clearOnHide: true,
                 type: 'datagrid',
                 addAnotherPosition: 'bottom',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'ngram',
                 key: '_ngram',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 rows: 3,
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 wysiwyg: false,
                 clearOnHide: true,
                 spellcheck: true,
                 validate: {
                   required: false,
                   minLength: '',
                   maxLength: '',
                   pattern: '',
                   custom: ''
                 },
                 type: 'textarea',
                 labelPosition: 'top',
                 inputFormat: 'plain',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
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
             display: 'form',
             submissionAccess: [
               {
                 roles: [],
                 type: 'create_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'read_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'update_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'delete_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'create_own'
               },
               {
                 roles: [],
                 type: 'read_own'
               },
               {
                 roles: [],
                 type: 'update_own'
               },
               {
                 roles: [],
                 type: 'delete_own'
               }
             ],
             title: 'Providers',
             name: 'providers',
             path: 'providers',
             access: [
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93d'],
                 type: 'read_all'
               }
             ],
             created: '2019-06-07T01:20:47.481+0000',
             modified: '2019-06-24T22:25:32.316+0000',
             machineName: 'providers'
           },
           {
             _id: '5cf9bc6790d44a00189ab95a',
             type: 'resource',
             tags: ['common'],
             deleted: null,
             owner: '5cf99e0590d44a00189ab94d',
             components: [
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 label: 'Country',
                 key: 'country',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '5cf99eb190d44a00189ab94f',
                   custom: ''
                 },
                 dataSrc: 'resource',
                 valueProperty: '_id',
                 defaultValue: '',
                 refreshOn: '',
                 filter: 'filter={"fields":{"id":true,"data":true,"data.name":true,"data.code":true}}',
                 authenticate: false,
                 template:
                   '<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #c7254e; background-color: #f9f2f4; border-radius: 4px;">{{ item.data.code }}</span><span> {{item.data.name}}</span>',
                 multiple: false,
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: false,
                 clearOnHide: true,
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 searchField: 'where={"$text": { "search": {{input}} }}'
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Tid',
                 key: 'tId',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: true,
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
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Code',
                 key: 'code',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Sku',
                 key: 'barcode',
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
                 properties: {
                   search: 'fuzzy'
                 },
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Clacom',
                 key: 'clacom',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 inputType: 'text',
                 inputMask: '',
                 label: 'Description',
                 key: 'description',
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
                 properties: {
                   search: 'fuzzy'
                 }
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'ngram',
                 key: '_ngram',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 rows: 3,
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 wysiwyg: false,
                 clearOnHide: true,
                 spellcheck: true,
                 validate: {
                   required: false,
                   minLength: '',
                   maxLength: '',
                   pattern: '',
                   custom: ''
                 },
                 type: 'textarea',
                 labelPosition: 'top',
                 inputFormat: 'plain',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'Origin',
                 key: 'origin',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: 'national',
                       label: 'National'
                     },
                     {
                       value: 'imported',
                       label: 'Imported'
                     },
                     {
                       value: 'both',
                       label: 'Both'
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '',
                   custom: ''
                 },
                 dataSrc: 'values',
                 valueProperty: '',
                 defaultValue: 'national',
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
                 validate: {
                   required: false
                 },
                 type: 'select',
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
                 tree: true,
                 components: [
                   {
                     input: true,
                     tree: true,
                     components: [
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'new',
                         key: 'new',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'previous',
                         key: 'previous',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'timestamp',
                         key: 'timestamp',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'user',
                         key: 'user',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'kind',
                         key: 'kind',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: false,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       },
                       {
                         autofocus: false,
                         input: true,
                         tableView: false,
                         inputType: 'text',
                         inputMask: '',
                         label: 'path',
                         key: 'path',
                         placeholder: '',
                         prefix: '',
                         suffix: '',
                         multiple: true,
                         defaultValue: '',
                         protected: false,
                         unique: false,
                         persistent: true,
                         hidden: true,
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
                         inDataGrid: true,
                         labelPosition: 'top',
                         inputFormat: 'plain',
                         tags: [],
                         properties: {},
                         lockKey: true
                       }
                     ],
                     multiple: false,
                     tableView: false,
                     label: 'changes',
                     key: 'changes',
                     protected: false,
                     persistent: true,
                     hidden: false,
                     clearOnHide: true,
                     templates: {
                       header:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ component.label }} \n    </div> \n  {% }) %} \n</div>',
                       row:
                         '<div class="row"> \n  {%util.eachComponent(components, function(component) { %} \n    <div class="col-sm-2"> \n      {{ getView(component, row[component.key]) }} \n    </div> \n  {% }) %} \n  <div class="col-sm-2"> \n    <div class="btn-group pull-right"> \n      <div class="btn btn-default editRow">Edit</div> \n      <div class="btn btn-danger removeRow">Delete</div> \n    </div> \n  </div> \n</div>',
                       footer: ''
                     },
                     type: 'editgrid',
                     inDataGrid: true,
                     tags: [],
                     conditional: {
                       show: '',
                       when: null,
                       eq: ''
                     },
                     properties: {},
                     lockKey: true
                   }
                 ],
                 tableView: false,
                 label: 'History',
                 key: 'history',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 clearOnHide: true,
                 type: 'datagrid',
                 addAnotherPosition: 'bottom',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true,
                 source: '5cf9bbef90d44a00189ab958'
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
             display: 'form',
             submissionAccess: [
               {
                 roles: [],
                 type: 'create_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'read_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'update_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'delete_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'create_own'
               },
               {
                 roles: [],
                 type: 'read_own'
               },
               {
                 roles: [],
                 type: 'update_own'
               },
               {
                 roles: [],
                 type: 'delete_own'
               }
             ],
             title: 'Products',
             name: 'products',
             path: 'products',
             access: [
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93d'],
                 type: 'read_all'
               }
             ],
             created: '2019-06-07T01:22:47.762+0000',
             modified: '2019-06-24T22:25:56.072+0000',
             machineName: 'products'
           },
           {
             _id: '5cf9c3bd90d44a00189ab960',
             type: 'resource',
             tags: ['common'],
             deleted: null,
             owner: '5cf99e0590d44a00189ab94d',
             components: [
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 inputType: 'text',
                 inputMask: '',
                 label: 'compositeId',
                 key: 'compositeId',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 unique: true,
                 persistent: true,
                 hidden: true,
                 clearOnHide: true,
                 spellcheck: true,
                 validate: {
                   required: true,
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
                 properties: {},
                 lockKey: true,
                 calculateValue: 'value = `${data.country}_${data.provider}_${data.product}`;',
                 mask: false,
                 tabindex: 'admin@example.com'
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 label: 'Country',
                 key: 'country',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '5cf99eb190d44a00189ab94f',
                   custom: '',
                   headers: [
                     {
                       value: '',
                       key: ''
                     }
                   ]
                 },
                 dataSrc: 'resource',
                 valueProperty: '_id',
                 defaultValue: '',
                 refreshOn: '',
                 filter: 'filter={"fields":{"id":true,"data":true,"data.name":true,"data.code":true}}',
                 authenticate: false,
                 template:
                   '<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #c7254e; background-color: #f9f2f4; border-radius: 4px;">{{ item.data.code }}</span><span> {{item.data.name}}</span>',
                 multiple: false,
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: false,
                 clearOnHide: true,
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 searchField: 'where={"$text": { "search": {{input}} }}',
                 reference: true,
                 lockKey: true,
                 limit: '20'
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 label: 'Provider',
                 key: 'provider',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '5cf9bbef90d44a00189ab958',
                   custom: ''
                 },
                 dataSrc: 'resource',
                 valueProperty: '_id',
                 defaultValue: '',
                 refreshOn: '_ngram',
                 filter:
                   'filter={"fields":{"id":true,"data":true,"data.name":true,"data.code":true, "data.country":true}, "related": ["countries"]}',
                 authenticate: false,
                 template:
                   '<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #3dc725; background-color: #f4f9f; border-radius: 4px;">{{ item.related.countries.data.name }}</span>\n<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #c7254e; background-color: #f9f2f4; border-radius: 4px;">{{ item.data.code }}</span><span> {{item.data.name}}</span>',
                 multiple: false,
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: false,
                 clearOnHide: true,
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 searchField: 'where={"$text": { "search": {{input}} }}',
                 limit: '99',
                 lockKey: true,
                 reference: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: true,
                 label: 'Product',
                 key: 'product',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     }
                   ],
                   json: '',
                   url: '',
                   resource: '5cf9bc6790d44a00189ab95a',
                   custom: ''
                 },
                 dataSrc: 'resource',
                 valueProperty: '_id',
                 defaultValue: '',
                 refreshOn: '_ngram',
                 filter:
                   'filter={"fields":{"id":true,"data":true,"data.description":true,"data.code":true, "data.country":true, "data.provider":true}, "related": ["countries","providers"]}',
                 authenticate: false,
                 template:
                   '<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #3dc725; background-color: #f4f9f; border-radius: 4px;">{{ item.related.providers.data.name }}</span>\n<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #a5a5a5; background-color: #f4f9f; border-radius: 4px;">({{ item.related.countries.data.name }})</span>\n<span style="padding: 2px 4px; font-size: 90%; font-family: Menlo,Monaco,Consolas,Courier New,monospace; color: #c7254e; background-color: #f9f2f4; border-radius: 4px;">{{ item.data.code }}</span><span> {{item.data.description}}</span>',
                 multiple: false,
                 protected: false,
                 unique: false,
                 persistent: true,
                 hidden: false,
                 clearOnHide: true,
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 searchField: 'where={"$text": { "search": {{input}} }}',
                 reference: true,
                 limit: '99'
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'Clasification',
                 key: 'classification',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     },
                     {
                       value: 'complete',
                       label: 'A (Complete)'
                     },
                     {
                       value: 'incomplete',
                       label: 'B (Incomplete)'
                     },
                     {
                       value: 'limited',
                       label: 'C (Limited)'
                     },
                     {
                       value: 'technicalInformation',
                       label: 'Technical Information'
                     }
                   ],
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
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'Criticality',
                 key: 'criticality',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     },
                     {
                       value: 'technical',
                       label: '1. Technical Spec'
                     },
                     {
                       value: 'standard',
                       label: '2. Standard Spec'
                     },
                     {
                       value: 'technicalInformation',
                       label: '3. Technical Information'
                     }
                   ],
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
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: "Provider's approval",
                 key: 'providerApproval',
                 placeholder: '',
                 data: {
                   values: [
                     {
                       value: '',
                       label: ''
                     },
                     {
                       value: 'approved',
                       label: 'Approved'
                     },
                     {
                       value: 'readButNotApproves',
                       label: 'Read, but not approves'
                     },
                     {
                       value: 'noInformation',
                       label: 'No Information'
                     }
                   ],
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
                 validate: {
                   required: false
                 },
                 type: 'select',
                 labelPosition: 'top',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               },
               {
                 autofocus: false,
                 input: true,
                 tableView: false,
                 label: 'ngram',
                 key: '_ngram',
                 placeholder: '',
                 prefix: '',
                 suffix: '',
                 rows: 3,
                 multiple: false,
                 defaultValue: '',
                 protected: false,
                 persistent: true,
                 hidden: true,
                 wysiwyg: false,
                 clearOnHide: true,
                 spellcheck: true,
                 validate: {
                   required: false,
                   minLength: '',
                   maxLength: '',
                   pattern: '',
                   custom: ''
                 },
                 type: 'textarea',
                 labelPosition: 'top',
                 inputFormat: 'plain',
                 tags: [],
                 conditional: {
                   show: '',
                   when: null,
                   eq: ''
                 },
                 properties: {},
                 lockKey: true
               }
             ],
             display: 'form',
             submissionAccess: [
               {
                 roles: [],
                 type: 'create_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c'],
                 type: 'read_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'update_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93b'],
                 type: 'delete_all'
               },
               {
                 roles: ['5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93b'],
                 type: 'create_own'
               },
               {
                 roles: [],
                 type: 'read_own'
               },
               {
                 roles: [],
                 type: 'update_own'
               },
               {
                 roles: [],
                 type: 'delete_own'
               }
             ],
             title: 'Specifications',
             name: 'specifications',
             path: 'specifications',
             access: [
               {
                 roles: ['5cf99e0490d44a00189ab93b', '5cf99e0490d44a00189ab93c', '5cf99e0490d44a00189ab93d'],
                 type: 'read_all'
               }
             ],
             created: '2019-06-07T01:54:05.505+0000',
             modified: '2019-06-25T02:06:29.123+0000',
             machineName: 'specifications'
           }
  ]
})()