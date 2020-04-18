import { authenticate as lbauthenticate } from '@loopback/authentication'
import { AuthorizationMetadata, authorize as lbauthorize } from '@loopback/authorization'
import { inject } from '@loopback/core'
import { SecurityBindings } from '@loopback/security'
import { OPERATION_SECURITY_SPEC } from './providers/jwt/jwt.security'

export enum using {
  jwt = 'jwt'
}

export enum roles {
  Administrator = 'administrator'
}

export const security = OPERATION_SECURITY_SPEC

export const Auth = (() => {
  /**
   *
   * @param strategy
   * @param options
   */
  const authenticate = (strategy: using, options?: object) => {
    return lbauthenticate(strategy, options)
  }
  /**
   *
   * @param spec
   */
  const authorize = (spec: AuthorizationMetadata) => {
    return lbauthorize(spec)
  }
  /**
   *
   */
  const user = () => {
    return inject(SecurityBindings.USER, { optional: true })
  }

  return Object.freeze({ authenticate, authorize, user })
})()
