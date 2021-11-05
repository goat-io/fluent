import { InputType, OmitType } from '../../../../core/types'
import { RoleEntity } from './roles.entity'

@InputType()
export class RoleEntityIn extends OmitType(RoleEntity, ['id'] as const) {}
