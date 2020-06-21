import { InputType, PartialType } from '@nestjs/graphql'
import { OmitType, ApiProperty } from '@nestjs/swagger'
import { User } from './user.entity'
import { Column, Repository } from 'typeorm'
import { IPaginationMeta, IPaginationLinks } from '../../../dtos/pagination.dto'
import * as faker from 'faker'

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
