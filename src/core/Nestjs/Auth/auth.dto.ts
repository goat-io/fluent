import { InputType, ObjectType } from '@nestjs/graphql'

@InputType()
export class Login {
  email: string
  password: string
}

// tslint:disable-next-line: max-classes-per-file
@ObjectType()
export class Token {
  accessToken: string
}
