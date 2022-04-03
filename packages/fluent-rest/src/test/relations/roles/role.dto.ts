import { InputType, OmitType } from '@goatlab/fluent'
import { RoleEntity } from './roles.entity'

@InputType()
export class RoleEntityIn extends OmitType(RoleEntity, ['id'] as const) {}
