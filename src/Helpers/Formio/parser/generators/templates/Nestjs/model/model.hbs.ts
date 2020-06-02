export const template = `import { {{_Model.name}}BaseEntity, {{_Model.name}}BaseEntityFaker } from "./_base/entities/{{_Model.name}}-entity";
import {
  Entity,
} from 'typeorm'

@Entity()
export class {{_Model.name}}Entity extends {{_Model.name}}BaseEntity {}


export const {{_Model.name}}EntityFaker = (): {{_Model.name}}Entity => {
  const fakeBaseElement: {{_Model.name}}BaseEntity = {{_Model.name}}BaseEntityFaker()

  const fakeElement = {}

  return {...fakeBaseElement,...fakeElement} as {{_Model.name}}Entity
}
`
