import { UserDtoIn, UserDtoOut } from './User/users.dto'

import { AuthDtoOut } from './auth.dto'
import { GoatOutput } from '../../../Providers/types'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from './User/users.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UsersService,
    private readonly jwt: JwtService
  ) {}

  async login(user: GoatOutput<UserDtoIn, UserDtoOut>): Promise<AuthDtoOut> {
    const payload = {
      sub: user.id,
      user
    }
    return {
      token: this.jwt.sign(payload)
    }
  }

  async validateUser(
    UserInput: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut> | null> {
    return await this.userRepository.validate(UserInput)
  }
}
