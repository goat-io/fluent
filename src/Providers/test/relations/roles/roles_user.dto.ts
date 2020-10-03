import { InputType, OmitType } from '@nestjs/graphql'

import { RolesUser } from './roles_user.entity'

@InputType()
export class RoleUserEntityIn extends OmitType(RolesUser, ['id'] as const) {}
