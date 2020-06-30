import { OmitType, PartialType, ApiProperty } from '@nestjs/swagger'
import { Role } from './roles.entity'
import { InputType } from '@nestjs/graphql'
import { Column, Repository } from 'typeorm'
import { IPaginationMeta, IPaginationLinks } from '../../../dtos/pagination.dto'
import * as faker from 'faker'
/**
 *
 */
@InputType()
export class RoleDtoOut extends OmitType(Role, ['deleted'] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class RoleDtoIn extends OmitType(Role, [
  'id',
  'created',
  'updated',
  'deleted'
] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class RoleDtoPatch extends PartialType(RoleDtoIn) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class RoleDtoPaginated {
  @Column(type => RoleDtoOut)
  @ApiProperty({ isArray: true, type: RoleDtoOut })
  items: RoleDtoOut[]

  @Column(type => IPaginationMeta)
  @ApiProperty({ type: IPaginationMeta })
  meta: IPaginationMeta

  @Column(type => IPaginationLinks)
  @ApiProperty({ type: IPaginationLinks })
  links: IPaginationLinks
}
