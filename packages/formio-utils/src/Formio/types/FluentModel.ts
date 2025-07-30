export interface FluentModel {
  id?: string
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
  datagrids: {
    [key: string]: any
  }
  objects: {
    [key: string]: any
  }
}
