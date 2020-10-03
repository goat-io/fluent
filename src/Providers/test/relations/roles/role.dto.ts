import { InputType, OmitType } from '@nestjs/graphql'

import { RoleEntity } from './roles.entity'

@InputType()
export class RoleEntityIn extends OmitType(RoleEntity, ['id'] as const) {}
