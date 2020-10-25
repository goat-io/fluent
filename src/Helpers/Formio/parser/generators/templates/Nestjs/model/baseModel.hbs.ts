export const template = `import { Decorators } from '@goatlab/fluent/dist/core/Nestjs/Database/decorators'
import * as faker from 'faker'
import {Access} from "@goatlab/fluent/dist/core/dtos/access.dto"
{{#each this}}{{#if isDatagrid}}import { {{dgPath}}BaseEntity, {{dgPath}}BaseEntityFaker } from "./{{dgPath}}-entity";\n{{/if}}{{#if isObject}}import { {{path}}BaseEntity, {{path}}BaseEntityFaker } from "./{{path}}-entity";\n{{/if}}{{/each}}

{{#if _Model.isMain}}
@Decorators.entity('{{_Model.name}}')
{{/if}}
export class {{_Model.name}}BaseEntity {
  {{> typeProperty}}

  {{#if _Model.isMain}}
  @Decorators.created()
  created: Date

  @Decorators.updated()
  updated: Date

  @Decorators.deleted()
  deleted: Date

  @Decorators.version()
  version: number

  @Decorators.embedArray(Access, {required: false})
  access?: Access[]

  @Decorators.embedArray(Access, {required: false})
  submissionAccess?: Access[]
  {{/if}}
}

export const {{_Model.name}}BaseEntityFaker = (): {{_Model.name}}BaseEntity{{#if _Model.isArray}}[]{{/if}} => {
  const fakeElement: {{_Model.name}}BaseEntity = {
    {{#if _Model.isMain}}
    created: faker.date.recent(),
    updated: faker.date.recent(),
    deleted: faker.date.recent(),
    version: faker.random.number(),
    access: [
      {
        type: faker.random.word(),
        roles: [faker.random.uuid(), faker.random.uuid()]
      }
    ],
    submissionAccess: [
      {
        type: faker.random.word(),
        roles: [faker.random.uuid(), faker.random.uuid()]
      }
    ],
    {{/if}}
    {{> fakerObject}}
  }

  {{#if _Model.isArray}}
  return [fakeElement, fakeElement,fakeElement] 
  {{else}}
  return fakeElement
  {{/if}}
}
`
