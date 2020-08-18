import { ApiProperty, OmitType } from '@nestjs/swagger'
import { IPaginationLinks, IPaginationMeta } from '../../../dtos/pagination.dto'
import { InputType, PartialType } from '@nestjs/graphql'

import { Column } from 'typeorm'
import { User } from './user.entity'

/**
 *
 */
@InputType()
export class UserDtoOut extends OmitType(User, [
  'deleted',
  'version'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class UserDtoIn extends OmitType(User, [
  'id',
  'created',
  'updated',
  'deleted',
  'version'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class UserDtoPatch extends PartialType(UserDtoIn) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class UserDtoPaginated {
  @Column(type => UserDtoOut)
  @ApiProperty({ isArray: true, type: UserDtoOut })
  items: UserDtoOut[]

  @Column(type => IPaginationMeta)
  @ApiProperty({ type: IPaginationMeta })
  meta: IPaginationMeta

  @Column(type => IPaginationLinks)
  @ApiProperty({ type: IPaginationLinks })
  links: IPaginationLinks
}
