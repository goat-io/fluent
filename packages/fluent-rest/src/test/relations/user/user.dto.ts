import { InputType, OmitType } from '@goatlab/fluent'
import { UsersEntity } from './user.entity'

@InputType()
export class UsersEntityIn extends OmitType(UsersEntity, ['id'] as const) {}
