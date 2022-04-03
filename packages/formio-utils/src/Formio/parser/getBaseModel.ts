export interface IBaseModel {
  name: string
  path: string
  folderPath: string
  id?: string
  __datagrids: { [key: string]: any }
  __objects: { [key: string]: any }
  [key: string]: any
  options?: {
    validateUpsert: boolean
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
    Paginator?: {
      limit: number
    }
    Jwt?: boolean
    Distinct?: boolean
    Insert?: boolean
    Aggregate?: boolean
  }
  indexes?: {
    [key: string]: any
  }
}

export const baseModel: IBaseModel = {
  id: '',
  name: '',
  folderPath: '',
  base: 'PersistedModel',
  idInjection: false,
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
    },
    Paginator: {
      limit: 10
    },
    Jwt: true,
    Distinct: true,
    Insert: true,
    Aggregate: true
  },
  options: {
    validateUpsert: true,
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
  },
  excludeBaseProperties: [],
  validations: [],
  relations: {},
  acls: [],
  methods: {},
  indexes: {
    roles_1: {
      keys: { roles: 1 }
    },
    form_1: {
      keys: { form: 1 }
    },
    'access.id_1': {
      keys: { 'access.id': 1 }
    },
    owner_1: {
      keys: { owner: 1 }
    },
    created_1: {
      keys: { created: 1 }
    },
    modified_1: {
      keys: { modified: 1 }
    }
  }
}
