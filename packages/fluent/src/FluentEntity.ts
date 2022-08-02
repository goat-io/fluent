import { f } from './decorators'

export class FluentEntity {
  @f.id()
  id: string

  @f.property({ required: false })
  type?: string

  @f.stringArray(String, { required: false })
  roles?: string[]

  @f.created()
  created?: Date

  @f.updated()
  updated?: Date

  @f.deleted()
  deleted?: Date
}
