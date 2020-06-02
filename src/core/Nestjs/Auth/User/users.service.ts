import { Hash } from '../../../../Helpers/Hash'
import { Injectable, Inject } from '@nestjs/common'
import { Repository } from 'typeorm'
import { UpdateUserInput, UserInput } from './users.input'
import { User } from './user.entity'

@Injectable()
export class UsersService {
  constructor(
    @Inject('USER_REPOSITORY')
    private users: Repository<User>
  ) {}
  /**
   *
   * @param input
   */
  async create(input: UserInput): Promise<User> {
    const created = this.users.insert(input)
    return
  }
  /**
   *
   */
  async findAll(): Promise<User[]> {
    return await this.users.find()
  }
  /**
   *
   * @param id
   */
  async findOne(id: string): Promise<User> {
    return await this.users.findOne({ id: id })
  }
  /**
   *
   * @param input
   */
  async validate(input: UserInput): Promise<User | null> {
    const { email, password } = input
    const user = await this.users.findOne({ email })

    if (!user) return null

    const valid = await Hash.compare(password, user.password)

    return valid ? user : null
  }
  /**
   *
   * @param email
   */
  async findByEmail(email: string): Promise<User> {
    return await this.users.findOne({ email })
  }
  /**
   *
   * @param id
   */
  async deleteById(id: string): Promise<string> {
    await this.users.delete({ id: id })
    return id
  }
  /**
   *
   * @param id
   * @param user
   */
  /*
  async updateById(id: string, user: UpdateUserInput): Promise<User> {
    const inserted = await this.users.update({ id: id }, user)
    //return inserted
  }
  */
}
