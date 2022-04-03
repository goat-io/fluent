export const template = `import { {{_Model.name}}BaseEntity, {{_Model.name}}BaseEntityFaker } from "./_base/entities/{{_Model.name}}-entity";
import { Collection } from 'fireorm'
import {
  Entity,
} from 'typeorm'

@Entity({name: '{{_Model.name}}'})
@Collection('{{_Model.name}}')
export class {{_Model.name}}Entity extends {{_Model.name}}BaseEntity {}


export const {{_Model.name}}EntityFaker = (): {{_Model.name}}Entity => {
  const fakeBaseElement: {{_Model.name}}BaseEntity = {{_Model.name}}BaseEntityFaker()

  const fakeElement = {}

  return {...fakeBaseElement,...fakeElement} as {{_Model.name}}Entity
}
`
