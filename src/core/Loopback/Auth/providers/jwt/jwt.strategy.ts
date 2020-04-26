import { AuthenticationBindings, AuthenticationMetadata, AuthenticationStrategy } from '@loopback/authentication'
import { StrategyAdapter } from './strategyAdapter'
import { BindingScope, extensionPoint, inject, Provider, ValueOrPromise } from '@loopback/core'
import { repository } from '@loopback/repository'
import { securityId, UserProfile } from '@loopback/security'
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt'
import { UserRepository } from '../../User/user.repository'
import { JWT_SECRET, JWT_STRATEGY_NAME, JWT_URL_PARAM_KEY } from './jwt.constants'

export interface Credentials {
  id: string
  username: string
  password: string
}
/**
 * The strategy provider will parse the specified strategy, and act accordingly
 */
@extensionPoint(AuthenticationBindings.AUTHENTICATION_STRATEGY_EXTENSION_POINT_NAME, { scope: BindingScope.TRANSIENT })
export class JwtStrategyProvider implements Provider<AuthenticationStrategy | undefined> {
  constructor(
    @repository(UserRepository) private userRepository: UserRepository,
    @inject(AuthenticationBindings.METADATA)
    private metadata?: AuthenticationMetadata
  ) {}

  public value(): ValueOrPromise<AuthenticationStrategy | undefined> {
    if (!this.metadata) {
      return undefined
    }

    const { strategy } = this.metadata

    if (strategy === JWT_STRATEGY_NAME) {
      const jwtStrategy = new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromExtractors([
            ExtractJwt.fromAuthHeaderAsBearerToken(),
            ExtractJwt.fromUrlQueryParameter(JWT_URL_PARAM_KEY)
          ]),
          secretOrKey: JWT_SECRET
        },
        (payload, done) => this.verifyToken(payload, done)
      )

      return new StrategyAdapter(jwtStrategy, JWT_STRATEGY_NAME)
    }
  }

  /**
   *
   * @param payload
   * @param done
   */
  public async verifyToken(
    payload: Credentials,
    done: (err: Error | null, user?: UserProfile | false, info?: object) => void
  ) {
    try {
      const { id } = payload

      const user = await this.userRepository.roles(id)

      if (!user) {
        done(null, false)
      }

      done(null, { name: user.firstName, email: user.email, [securityId]: id, roles: user.roles })
    } catch (err) {
      if (err.name === 'UnauthorizedError') {
        done(null, false)
      }
      done(err, false)
    }
  }
  /*
  // Just keeping this to reuse later on role checking
  // verify user's role based on the SecuredType
  public async verifyRoles(id: string) {
    const { type, roles } = this.metadata

    if ([SecuredType.IS_AUTHENTICATED, SecuredType.PERMIT_ALL].includes(type)) {
      return
    }

    if (type === SecuredType.HAS_ANY_ROLE) {
      if (!roles.length) {
        return
      }
      const { count } = await this.userRoleRepository.count({
        userId: id,
        roleId: { inq: roles }
      })

      if (count) {
        return
      }
    } else if (type === SecuredType.HAS_ROLES && roles.length) {
      const userRoles = await this.userRoleRepository.find({ where: { userId: id } })
      const roleIds = userRoles.map(ur => ur.roleId)
      let valid = true
      for (const role of roles) {
        if (!roleIds.includes(role)) {
          valid = false
          break
        }
      }

      if (valid) {
        return
      }
    }

    throw new HttpErrors.Unauthorized('Invalid authorization')
  }
  */
}
