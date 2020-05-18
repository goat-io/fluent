import { InputType, PartialType } from '@nestjs/graphql'

@InputType()
export class UserInput {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

// tslint:disable-next-line: max-classes-per-file
@InputType()
export class UpdateUserInput extends PartialType(UserInput) {}
