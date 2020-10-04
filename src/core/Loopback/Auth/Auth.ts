import {
  AuthenticationMetadata,
  authenticate as lbauthenticate
} from '@loopback/authentication'
import {
  AuthorizationMetadata,
  authorize as lbauthorize
} from '@loopback/authorization'

import { OPERATION_SECURITY_SPEC } from './providers/jwt/jwt.security'
import { SecurityBindings } from '@loopback/security'
import { inject } from '@loopback/core'

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
  const authenticate = (
    strategy: using,
    options?: string | AuthenticationMetadata
  ) => {
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
