import { Getter, inject } from '@loopback/core'
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  juggler,
  repository
} from '@loopback/repository'
import { HttpErrors } from '@loopback/rest'
import { securityId, UserProfile } from '@loopback/security'
import { validate } from 'isemail'
import { Hash } from '../../../../Helpers/Hash'
import { UserCredentials } from './Credentials/user-credentials.model'
import { UserCredentialsRepository } from './Credentials/user-credentials.repository'
import { UserRoleModel } from './Role/user-role.model'
import { UserRoleRepository } from './Role/user-role.repository'
import { User } from './user.model'
import { UserWithRoles } from './userWithRoles.model'

export interface Credentials {
  email: string
  password: string
}

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id
> {
  public readonly userCredentials: HasOneRepositoryFactory<
    UserCredentials,
    typeof User.prototype.id
  >
  public readonly userRoles: HasManyRepositoryFactory<
    UserRoleModel,
    typeof UserRoleModel.prototype.id
  >
  constructor(
    @inject('datasources.mongo') protected datasource: juggler.DataSource,
    @repository.getter('UserCredentialsRepository')
    protected userCredentialsRepositoryGetter: Getter<
      UserCredentialsRepository
    >,
    @repository.getter('UserRoleRepository')
    getUserRolesRepository: Getter<UserRoleRepository>
  ) {
    super(User, datasource)
    this.userCredentials = this.createHasOneRepositoryFactoryFor(
      'userCredentials',
      userCredentialsRepositoryGetter
    )
    this.userRoles = this.createHasManyRepositoryFactoryFor(
      'userRoles',
      getUserRolesRepository
    )
    this.registerInclusionResolver(
      'userRoles',
      this.userRoles.inclusionResolver
    )
  }

  public async roles(userId: typeof User.prototype.id): Promise<UserWithRoles> {
    const user: any = await this.findById(userId, {
      include: [
        { relation: 'userRoles', scope: { include: [{ relation: 'role' }] } }
      ]
    })
    user.roles = user.userRoles.map(r => r.role)
    delete user.userRoles
    const result = new UserWithRoles(user)
    return result
  }

  public async findCredentials(
    userId: typeof User.prototype.id
  ): Promise<UserCredentials | undefined> {
    try {
      return await this.userCredentials(userId).get()
    } catch (err) {
      if (err.code === 'ENTITY_NOT_FOUND') {
        return undefined
      }
      throw err
    }
  }
  /**
   *
   * @param credentials
   */
  public async verifyCredentials(credentials: Credentials): Promise<User> {
    const invalidCredentialsError = 'Invalid email or password.'

    const foundUser = await this.findOne({
      where: { email: credentials.email }
    })

    if (!foundUser) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError)
    }

    const credentialsFound = await this.findCredentials(foundUser.id)

    if (!credentialsFound) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError)
    }

    const passwordMatched = await Hash.compare(
      credentials.password,
      credentialsFound.password
    )

    if (!passwordMatched) {
      throw new HttpErrors.Unauthorized(invalidCredentialsError)
    }

    return foundUser
  }
  /**
   *
   * @param user
   */
  public convertToUserProfile(user: User): UserProfile {
    let userName = ''
    if (user.firstName) {
      userName = `${user.firstName}`
    }
    if (user.lastName) {
      userName = user.firstName
        ? `${userName} ${user.lastName}`
        : `${user.lastName}`
    }
    return { [securityId]: user.id, name: userName, id: user.id }
  }
  /**
   *
   * @param credentials
   */
  public validateCredentials(credentials: Credentials) {
    if (!validate(credentials.email)) {
      throw new HttpErrors.UnprocessableEntity('invalid email')
    }

    if (!credentials.password || credentials.password.length < 8) {
      throw new HttpErrors.UnprocessableEntity(
        'password must be minimum 8 characters'
      )
    }
  }
}
