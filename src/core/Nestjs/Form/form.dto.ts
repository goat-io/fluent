import { OmitType, PartialType, ApiProperty } from '@nestjs/swagger'
import { Form } from './form.entity'
import { InputType } from '@nestjs/graphql'
import { Column } from 'typeorm'
import { IPaginationMeta, IPaginationLinks } from '../../dtos/pagination.dto'
import * as faker from 'faker'
/**
 *
 */
@InputType()
export class FormDtoOut extends OmitType(Form, [
  'deleted',
  'access',
  'submissionAccess',
  'version'
] as const) {}

export const fakeFormOut = (): FormDtoOut => {
  return {
    _id: faker.random.uuid(),
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
    components: ''
  }
}

export const formOutKeys = Object.keys(fakeFormOut())
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class FormDtoIn extends OmitType(Form, [
  '_id',
  'created',
  'updated',
  'deleted'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class FormDtoPatch extends PartialType(FormDtoIn) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class FormDtoPaginated {
  @Column(type => FormDtoOut)
  @ApiProperty({ isArray: true, type: FormDtoOut })
  items: FormDtoOut[]

  @Column(type => IPaginationMeta)
  @ApiProperty({ type: IPaginationMeta })
  meta: IPaginationMeta

  @Column(type => IPaginationLinks)
  @ApiProperty({ type: IPaginationLinks })
  links: IPaginationLinks
}
