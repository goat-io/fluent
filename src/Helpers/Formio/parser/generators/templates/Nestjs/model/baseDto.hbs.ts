export const template = `import { OmitType, PartialType, ApiProperty } from '@nestjs/swagger'
import { {{_Model.name}}Entity, {{_Model.name}}EntityFaker } from "./{{_Model.name}}.entity";
import { InputType } from '@nestjs/graphql'
import { Column, Repository } from 'typeorm'
import { IPaginationMeta, IPaginationLinks } from '@goatlab/fluent/dist/core/dtos/pagination.dto'

@InputType()
export class {{_Model.name}}DtoOut extends OmitType({{_Model.name}}Entity, [
  'deleted',
  'access',
  'submissionAccess',
  'version',
  '_ngram',
  'form'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class {{_Model.name}}DtoIn extends OmitType({{_Model.name}}Entity , [
  '_id',
  'created',
  'updated',
  'deleted',
  'access',
  'submissionAccess',
  'version',
  'owner',
  'roles',
  '_ngram',
  'form'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class {{_Model.name}}DtoPatch extends PartialType({{_Model.name}}DtoIn) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class {{_Model.name}}DtoPaginated {
  @Column(type => {{_Model.name}}DtoOut)
  @ApiProperty({ isArray: true, type: {{_Model.name}}DtoOut })
  items: {{_Model.name}}DtoOut[]

  @Column(type => IPaginationMeta)
  @ApiProperty({ type: IPaginationMeta })
  meta: IPaginationMeta

  @Column(type => IPaginationLinks)
  @ApiProperty({ type: IPaginationLinks })
  links: IPaginationLinks
}
`
