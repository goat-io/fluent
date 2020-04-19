import { AuthorizationContext, AuthorizationDecision, AuthorizationMetadata, Authorizer } from '@loopback/authorization'
import { Provider } from '@loopback/core'
import { securityId, UserProfile } from '@loopback/security'

export class GoatAuthorizationProvider implements Provider<Authorizer> {
  public value(): Authorizer {
    return this.authorize.bind(this)
  }
  public async authorize(context: AuthorizationContext, metadata: AuthorizationMetadata) {
    if (context.principals.length < 1) {
      return AuthorizationDecision.DENY
    }
    const user = context.principals[0]

    const AuthUser: UserProfile = { [securityId]: user[securityId], name: user.name, roles: user.roles }

    if (!metadata.allowedRoles) {
      return AuthorizationDecision.ALLOW
    }

    if (!AuthUser.roles || AuthUser.roles.length === 0) {
      return AuthorizationDecision.DENY
    }

    let isAllowed = false
    for (const role of AuthUser.roles) {
      if (metadata.allowedRoles.includes(role.name.toLowerCase())) {
        isAllowed = true
        break
      }
    }

    if (isAllowed) {
      return AuthorizationDecision.ALLOW
    }

    return AuthorizationDecision.DENY
  }
}
