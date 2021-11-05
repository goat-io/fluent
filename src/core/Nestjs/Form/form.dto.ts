import {
  ApiProperty,
  OmitType,
  InputType,
  Column,
  PartialType
} from '../../../core/types'
import { IPaginationLinks, IPaginationMeta } from '../../dtos/pagination.dto'
import { Form } from './form.entity'

/**
 *
 */
@InputType()
export class FormDtoOut extends OmitType(Form, [
  'deleted',
  'access',
  'submissionAccess'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class FormDtoIn extends OmitType(Form, [
  'id',
  'created',
  'updated',
  'deleted',
  'access',
  'submissionAccess'
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
