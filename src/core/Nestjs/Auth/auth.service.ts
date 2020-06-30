import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserDtoIn, UserDtoOut } from './User/users.dto'
import { User } from './User/user.entity'
import { UsersService } from './User/users.service'
import { AuthDtoOut } from './auth.dto'
import { GoatOutput } from '../../../Providers/types'

@Injectable()
export class AuthService {
  private users: UsersService['model']
  constructor(
    private readonly userRepository: UsersService,
    private readonly jwt: JwtService
  ) {
    this.users = this.userRepository.model
  }

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

  async validate({ id }): Promise<GoatOutput<UserDtoIn, UserDtoOut> | null> {
    const user = await this.users.findById(id)
    if (!user) throw Error('Authenticate validation error')
    return user
  }
}
