import { AuthenticationBindings } from '@loopback/authentication'
import { addExtension } from '@loopback/core'
import { PackageInfo } from '../../../goat'
import { SECURITY_SCHEME_SPEC } from './jwt.security'
import { JwtStrategyProvider } from './jwt.strategy'

export const use = (app: any, pkg: PackageInfo): void => {
  app.api({
    components: {
      securitySchemes: SECURITY_SCHEME_SPEC
    },
    info: {
      title: pkg.name,
      version: pkg.version
    },
    openapi: '3.0.0',
    paths: {},
    servers: [{ url: '/' }]
  })

  addExtension(app, AuthenticationBindings.AUTHENTICATION_STRATEGY_EXTENSION_POINT_NAME, JwtStrategyProvider, {
    namespace: AuthenticationBindings.AUTHENTICATION_STRATEGY_EXTENSION_POINT_NAME
  })
}
