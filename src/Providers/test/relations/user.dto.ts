import { InputType, OmitType } from '@nestjs/graphql'

import { UsersEntity } from './user.entity'

@InputType()
export class UsersEntityIn extends OmitType(UsersEntity, ['id'] as const) {}
