import { InputType, OmitType } from '../../../../core/types'
import { UsersEntity } from './user.entity'

@InputType()
export class UsersEntityIn extends OmitType(UsersEntity, ['id'] as const) {}
