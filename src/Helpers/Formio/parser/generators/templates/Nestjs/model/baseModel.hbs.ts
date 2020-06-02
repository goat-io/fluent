export const template = `import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ObjectIdColumn
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'
import { Field, ID, ObjectType } from '@nestjs/graphql'
import * as faker from 'faker'
import {Access} from "@goatlab/fluent/dist/core/dtos/access.dto"
{{#each this}}{{#if isDatagrid}}import { {{dgPath}}BaseEntity, {{dgPath}}BaseEntityFaker } from "./{{dgPath}}-entity";\n{{/if}}{{#if isObject}}import { {{path}}BaseEntity, {{path}}BaseEntityFaker } from "./{{path}}-entity";\n{{/if}}{{/each}}

{{#if _Model.isMain}}
@Entity()
{{/if}}
@ObjectType()
export class {{_Model.name}}BaseEntity {
  {{> typeProperty}}

  {{#if _Model.isMain}}
  @CreateDateColumn()
  @ApiProperty()
  created: Date

  @UpdateDateColumn()
  @ApiProperty()
  updated: Date

  @DeleteDateColumn()
  @ApiProperty()
  deleted: Date

  @VersionColumn()
  @ApiProperty()
  version: number

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
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
