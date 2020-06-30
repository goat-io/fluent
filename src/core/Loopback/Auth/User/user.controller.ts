import { repository } from '@loopback/repository'
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  requestBody
} from '@loopback/rest'
import { securityId, UserProfile } from '@loopback/security'
import { omit, pick } from 'lodash'
import { Hash } from '../../../../Helpers/Hash'
import { Jwt } from '../../../../Helpers/Jwt'
import { Auth, roles, using } from '../Auth'
import { OPERATION_SECURITY_SPEC } from '../providers/jwt/jwt.security'
import { NewUserRequest } from './newUser.model'
import { User as UserModel } from './user.model'
import { Credentials, UserRepository } from './user.repository'
import { UserWithRoles } from './userWithRoles.model'

const jwtSecret: string = 'changeme'
const jwtDuration: string = '7d'
const openAPITag: string = 'Users'

export class UserController {
  constructor(
    @repository(UserRepository) public userRepository: UserRepository,
    @Auth.user() private AuthUser: UserProfile
  ) {}
  @post('/users', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              'x-ts-type': UserModel
            }
          }
        },
        description: 'UserModel'
      }
    },
    tags: [openAPITag]
  })
  // @Auth.authenticate(using.jwt)
  public async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(NewUserRequest, {
            title: 'NewUser'
          })
        }
      }
    })
    newUserRequest: NewUserRequest
  ): Promise<UserModel> {
    // ensure a valid email value and password value
    this.userRepository.validateCredentials(
      pick(newUserRequest, ['email', 'password'])
    )

    // encrypt the password
    const password = await Hash.hash(newUserRequest.password)

    try {
      // create the new user
      const savedUser = await this.userRepository.create(
        omit(newUserRequest, 'password')
      )

      // set the password
      await this.userRepository
        .userCredentials(savedUser.id)
        .create({ password })

      return savedUser
    } catch (error) {
      // TODO what if we are not using mongo?
      // MongoError 11000 duplicate key
      if (error.code === 11000 && error.errmsg.includes('index: uniqueEmail')) {
        throw new HttpErrors.Conflict('Email value is already taken')
      } else {
        throw error
      }
    }
  }

  @get('/users/{userId}', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              'x-ts-type': UserModel
            }
          }
        },
        description: 'UserModel'
      }
    },
    tags: [openAPITag]
  })
  @Auth.authenticate(using.jwt)
  public async findById(
    @param.path.string('userId') userId: string
  ): Promise<UserModel> {
    return this.userRepository.findById(userId)
  }

  @get('/users/me', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: getModelSchemaRef(UserWithRoles, {
              title: 'UserWithRoles'
            })
          }
        },
        description: 'The current user profile'
      }
    },
    security: OPERATION_SECURITY_SPEC,
    tags: [openAPITag]
  })
  @Auth.authenticate(using.jwt)
  @Auth.authorize({
    allowedRoles: [roles.Administrator]
  })
  public async getCurrentUser() {
    return this.AuthUser
  }
  /**
   *
   * @param credentials
   */
  @post('/users/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    tags: [openAPITag]
  })
  public async login(
    @requestBody({
      description: 'The input of login function',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email'
              },
              password: {
                type: 'string',
                minLength: 8
              }
            }
          }
        }
      }
    })
    credentials: Credentials
  ): Promise<{ token: string }> {
    const user = await this.userRepository.verifyCredentials(credentials)

    const userProfile = this.userRepository.convertToUserProfile(user)

    const token = await Jwt.generate(userProfile, {
      secret: jwtSecret,
      expiresIn: jwtDuration
    })

    return { token }
  }
}
