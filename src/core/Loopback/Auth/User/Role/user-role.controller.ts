import { Filter, repository } from '@loopback/repository'
import { get, getFilterSchemaFor, getModelSchemaRef, HttpErrors, param, post, requestBody } from '@loopback/rest'
import { UserProfile } from '@loopback/security'
import { Auth } from '../../Auth'
import { Role as RoleModel } from '../../Role/role.model'
import { RoleRepository } from '../../Role/role.repository'
import { UserRepository } from '../user.repository'
import { UserRoleModel } from './user-role.model'
import { UserRoleRepository } from './user-role.repository'

const openAPITag: string = 'Users'
export class UserRoleController {
  constructor(
    @repository(UserRoleRepository) public userRoleRepository: UserRoleRepository,
    @repository(RoleRepository) public roleRepository: RoleRepository,
    @repository(UserRepository) public userRepository: UserRepository,
    @Auth.user() private AuthUser: UserProfile
  ) {}

  @get('users/{userId}/roles', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              items: getModelSchemaRef(RoleModel, {
                includeRelations: true
              }),
              type: 'array'
            }
          }
        },
        description: 'Array of Role model instances'
      }
    },
    tags: [openAPITag]
  })
  public async find(
    @param.path.string('userId') userId: string,
    @param.query.object('filter', getFilterSchemaFor(RoleModel))
    filter?: Filter<RoleModel>
  ): Promise<RoleModel[]> {
    const rolesIds = (
      await this.userRoleRepository.find({
        fields: { roleId: true },
        where: { userId }
      })
    ).map(role => role.roleId)

    const filterWhere = Object.assign({}, filter.where)
    delete filter.where
    const findFilter = Object.assign({}, { where: { and: [{ _id: { inq: rolesIds } }, filterWhere] } }, filter)
    return this.roleRepository.find(findFilter)
  }
  /*
   * /POST/
   * Attach a new Role for the user
   */
  @post('users/{userId}/roles/{roleId}', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              'x-ts-type': UserRoleModel
            }
          }
        },
        description: 'UserRoleModel'
      }
    },
    tags: [openAPITag]
  })
  public async create(
    @param.path.string('userId') userId: string,
    @param.path.string('roleId') roleId: string
  ): Promise<UserRoleModel> {
    await this.roleRepository.findById(roleId)
    await this.userRepository.findById(userId)
    const userRole = await this.userRoleRepository.create({ userId, roleId })
    return userRole
  }
}
