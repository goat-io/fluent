export interface IBaseModel {
  name: string
  path: string
  folderPath: string
  id?: string
  __datagrids: { [key: string]: any }
  __objects: { [key: string]: any }
  [key: string]: any
  options?: {
    strictObjectIDCoercion: boolean
    mongodb: {
      collection: string
    }
  }
  properties?: {
    id?: { type: string; id: boolean; generated: boolean; required: boolean }
    owner?: {
      type: string
      required: boolean
    }
    roles?: {
      type: string
      array: boolean
      required: boolean
    }
    _ngram?: {
      type: string
      required: boolean
    }
    form?: {
      type: string
      required: boolean
    }
    [key: string]: any
  }
  mixins: {
    FormSelection?: {
      id: string
    }
    Related?: {
      models: []
    }
    Search?: {
      enabled: boolean
      fullText: string[]
      nGram: string[]
    }
  }
}

export const baseModel: IBaseModel = {
  id: '',
  folderPath: '',
  // tslint:disable-next-line: object-literal-sort-keys
  __datagrids: {},
  __objects: {},
  mixins: {
    FormSelection: {
      id: ''
    },
    Related: {
      models: []
    },
    Search: {
      enabled: false,
      fullText: [],
      nGram: []
    }
  },
  name: '',
  options: {
    mongodb: {
      collection: 'submissions'
    },
    strictObjectIDCoercion: true
  },
  path: '',
  properties: {
    id: { type: 'string', id: true, generated: true, required: true },
    owner: {
      required: false,
      type: 'string'
    },
    roles: {
      array: true,
      required: false,
      type: 'string'
    },
    _ngram: {
      required: false,
      type: 'string'
    },
    form: {
      required: false,
      type: 'string'
    }
  }
  /*
    indexes: {
      roles: {
        keys: { "_meta.roles": 1 }
      },
      form: {
        keys: { "_meta.form": 1 }
      },
      "access.id": {
        keys: { "_meta.access.id": 1 }
      },
      owner: {
        keys: { "_meta.owner": 1 }
      },
      created: {
        keys: { "_meta.created": 1 }
      },
      modified: {
        keys: { "_meta.modified": 1 }
      },
      search_text: { "_meta._ngram": "text" }
    }
    */
}
