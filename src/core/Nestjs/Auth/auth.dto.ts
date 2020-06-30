import { InputType, ObjectType } from '@nestjs/graphql'

@InputType()
export class AuthDtoIn {
  email: string
  password: string
}

// tslint:disable-next-line: max-classes-per-file
@ObjectType()
export class AuthDtoOut {
  token: string
}
