import { Hash } from '../../../../Helpers/Hash'
import { Injectable, Inject } from '@nestjs/common'
import { Repository } from 'typeorm'
import { UserDtoOut, UserDtoIn } from './users.dto'
import { User } from './user.entity'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'
import { GoatOutput } from '../../../../Providers/types'

@Injectable()
export class UsersService {
  public model: TypeOrmConnector<User, UserDtoIn, UserDtoOut>

  constructor(
    @Inject('USER_REPOSITORY')
    private users: Repository<User>
  ) {
    this.model = new TypeOrmConnector<User, UserDtoIn, UserDtoOut>({
      repository: this.users
    })
  }

  async validate(
    input: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut> | null> {
    const { email, password } = input
    const user = await this.model
      .where(this.model._keys.email, '=', email)
      .first()

    if (!user) return null

    const valid = await Hash.compare(password, user.password)

    return valid ? user : null
  }
  /**
   *
   * @param email
   */
  async findByEmail(email: string): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    return this.model.where(this.model._keys.email, '=', email).first()
  }
}
