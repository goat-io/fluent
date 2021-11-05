import { InputType, OmitType } from '../../../../core/types'
import { RolesUser } from './roles_user.entity'

@InputType()
export class RoleUserEntityIn extends OmitType(RolesUser, ['id'] as const) {}
