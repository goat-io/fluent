import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository'
import {
  del,
  get,
  getFilterSchemaFor,
  getModelSchemaRef,
  getWhereSchemaFor,
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody
} from '@loopback/rest'
import { UserProfile } from '@loopback/security'
import { Auth } from '../Auth'
import { Role as RoleModel } from './role.model'
import { RoleRepository as RoleRepo } from './role.repository'

const openAPITag: string = 'Roles'
export class RoleController {
  constructor(
    @repository(RoleRepo) public roleRepository: RoleRepo,
    @Auth.user() private AuthUser: UserProfile
  ) {}
  /*
   * /POST/
   * Creates a new Role
   */
  @post('/roles', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              'x-ts-type': RoleModel
            }
          }
        },
        description: 'RoleModel'
      }
    },
    tags: [openAPITag]
  })
  public async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(RoleModel, {
            title: 'NewRole'
          })
        }
      }
    })
    newRoleRequest: RoleModel
  ): Promise<RoleModel> {
    return this.roleRepository.create(newRoleRequest)
  }
  /*
   * /POST/
   * Creates many new Roles
   */
  // // @intercept(validateSubmission)
  @post('/roles/createMany', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              items: getModelSchemaRef(RoleModel),
              type: 'array'
            }
          }
        },
        description: 'Array of Role model instance'
      }
    },
    tags: [openAPITag]
  })
  public async createMany(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            items: getModelSchemaRef(RoleModel),
            type: 'array'
          }
        }
      }
    })
    RoleSubmission: RoleModel[]
  ): Promise<RoleModel[]> {
    return this.roleRepository.createAll(RoleSubmission)
  }
  /*
   * /PUT/
   * Replace a Form by id
   */
  // @intercept(validateForm)
  @put('/roles/{id}', {
    responses: {
      '204': {
        description: 'Role PUT success'
      }
    },
    tags: [openAPITag]
  })
  public async replaceById(
    @param.path.string('id') id: string,
    @requestBody() role: RoleModel
  ): Promise<void> {
    await this.roleRepository.replaceById(id, role)
  }
  /*
   * /PATCH/
   * Update a Role by id
   */
  // @intercept(validateSubmission)
  @patch('/roles/{id}', {
    responses: {
      '204': {
        description: 'Role PATCH success'
      }
    },
    tags: [openAPITag]
  })
  public async updateById(
    @param.path.string('id') id: string,
    @requestBody() RoleSubmission: RoleModel
  ): Promise<void> {
    await this.roleRepository.replaceById(id, RoleSubmission)
  }
  /*
   * /PATCH/
   * Update Role matching WHERE
   */
  // @intercept(validateSubmission)
  @patch('/roles', {
    responses: {
      '200': {
        content: { 'application/json': { schema: CountSchema } },
        description: 'Form Role success count'
      }
    },
    tags: [openAPITag]
  })
  public async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(RoleModel, { partial: true })
        }
      }
    })
    RoleSubmission: RoleModel,
    @param.query.object('where', getWhereSchemaFor(RoleModel))
    where?: Where<RoleModel>
  ): Promise<Count> {
    return this.roleRepository.updateAll(RoleSubmission, where)
  }
  /*
   * /GET/
   * Gets the count of Role WHERE
   */
  @get('/roles/count', {
    responses: {
      '200': {
        content: { 'application/json': { schema: CountSchema } },
        description: 'Role model count'
      }
    },
    tags: [openAPITag]
  })
  public async count(
    @param.query.object('where', getWhereSchemaFor(RoleModel))
    where?: Where<RoleModel>
  ): Promise<Count> {
    return this.roleRepository.count(where)
  }
  /*
   * /GET/
   * Get the Role with Filter
   */
  @get('/roles', {
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
    @param.query.object('filter', getFilterSchemaFor(RoleModel))
    filter?: Filter<RoleModel>
  ): Promise<RoleModel[]> {
    return this.roleRepository.find(filter)
  }
  /*
   * /GET/
   * Gets a specific Role by id
   */
  @get('/roles/{id}', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: getModelSchemaRef(RoleModel, {
              includeRelations: true
            })
          }
        },
        description: 'Role model instance'
      }
    },
    tags: [openAPITag]
  })
  public async findById(
    @param.path.string('id') id: string,
    @param.query.object('filter', getFilterSchemaFor(RoleModel))
    filter?: Filter<RoleModel>
  ): Promise<RoleModel> {
    return this.roleRepository.findById(id, filter)
  }
  /*
   * /DELETE/
   * Deletes a Role by id
   */
  @del('/roles/{id}', {
    responses: {
      '204': {
        description: 'Role DELETE success'
      }
    },
    tags: [openAPITag]
  })
  public async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.roleRepository.deleteById(id)
  }
}
