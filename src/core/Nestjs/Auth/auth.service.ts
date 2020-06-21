import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { bcryptjs } from 'bcryptjs'
import { cleanUserModel } from './cleanUserModel'
import { UserDtoIn, UserDtoOut } from './User/users.dto'
import { User } from './User/user.entity'
import { UsersService } from './User/users.service'
import { Token } from './auth.dto'
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

  async login(user: User): Promise<Token> {
    const payload = {
      sub: user.id,
      user: cleanUserModel(user)
    }
    return {
      accessToken: this.jwt.sign(payload)
    }
  }

  async signUp(
    createUserDto: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    const password = await bcryptjs.hash(createUserDto.password, 10)
    return this.users.insert({ ...createUserDto, password })
  }

  async validateUser(
    UserInput: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    return await this.userRepository.validate(UserInput)
  }

  async validate({ id }): Promise<GoatOutput<UserDtoIn, UserDtoOut> | null> {
    const user = await this.users.findById(id)
    if (!user) throw Error('Authenticate validation error')
    return user
  }
}
