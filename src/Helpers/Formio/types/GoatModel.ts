export interface GoatModel {
  _id?: string
  name: string
  path: string
  folderPath: string
  mixins: {
    [key: string]: any
  }
  options?: {
    [key: string]: any
  }
  properties?: {
    [key: string]: any
  }
  __datagrids: {
    [key: string]: any
  }
  __objects: {
    [key: string]: any
  }
}
