import { OmitType, PartialType } from '@nestjs/swagger'
import { Form } from './form.entity'
import { InputType } from '@nestjs/graphql'

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
