import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger'
import { IPaginationLinks, IPaginationMeta } from '../../../dtos/pagination.dto'

import { Column } from 'typeorm'
import { InputType } from '@nestjs/graphql'
import { Role } from './roles.entity'

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
