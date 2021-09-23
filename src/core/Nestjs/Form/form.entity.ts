import * as faker from 'faker'

import { Access } from '../../dtos/access.dto'
import { ApiProperty } from '@nestjs/swagger'
import { Column } from 'typeorm'
import { Decorators } from '../Database/decorators'

@Decorators.entity('form')
export class Form {
  @Decorators.id()
  id: string

  @Decorators.property({ unique: true })
  path: string

  @Decorators.property({ required: false })
  title?: string

  @Decorators.property({ required: false })
  name?: string

  @Decorators.property({ required: false })
  type?: string

  @Decorators.property({ required: false })
  description?: string

  @Column({ type: 'simple-array', nullable: true })
  @ApiProperty({ type: [String], nullable: true, required: false })
  tags?: string[]

  @Decorators.property({ required: false })
  display?: string

  @Decorators.property({ required: false })
  action?: string

  @Decorators.property({ required: true })
  owner: string

  @Decorators.property({ required: true })
  settings: number

  @Decorators.property({ required: true })
  properties: number

  @Decorators.property({ required: false })
  machineName?: string

  @Decorators.created()
  created: Date

  @Decorators.updated()
  updated: Date

  @Decorators.deleted()
  deleted: Date

  @Decorators.property({ required: false })
  components?: string

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
  submissionAccess?: Access[]
}

export const fakeForm = (): Form => {
  return {
    id: faker.random.uuid(),
    path: faker.name.firstName(),
    title: faker.name.firstName(),
    name: faker.name.firstName(),
    type: faker.name.firstName(),
    description: faker.random.words(),
    tags: [faker.random.word(), faker.random.word(), faker.random.word()],
    display: String(faker.random.boolean()),
    action: faker.random.word(),
    owner: faker.random.uuid(),
    settings: faker.random.number(),
    properties: faker.random.number(),
    machineName: faker.random.word(),
    created: faker.date.recent(),
    updated: faker.date.recent(),
    deleted: faker.date.recent(),
    components: '',
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
    ]
  }
}