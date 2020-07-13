import { Entity, model, property } from '@loopback/repository'
import { Id } from '../../../../Helpers/Id'

@model({
  settings: {
    strictObjectIDCoercion: true
  }
})
export class Role extends Entity {
  @property({
    default: () => Id.objectIdString(),
    id: true,
    type: 'string'
  })
  public id: string

  @property({
    type: 'string'
  })
  public name: string

  @property({
    type: 'string'
  })
  public description?: string

  constructor(data?: Partial<Role>) {
    super(data)
  }
}
