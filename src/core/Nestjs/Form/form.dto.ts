import { OmitType, PartialType, ApiProperty } from '@nestjs/swagger'
import { Form } from './form.entity'
import { InputType } from '@nestjs/graphql'
import { Column } from 'typeorm'
import { IPaginationMeta, IPaginationLinks } from '../../dtos/pagination.dto'
/**
 *
 */
@InputType()
export class FormDtoOut extends OmitType(Form, ['deleted'] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class FormDtoIn extends OmitType(Form, [
  '_id',
  'created',
  'modified',
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
