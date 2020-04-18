import { AuthenticationComponent } from '@loopback/authentication'
import { AuthorizationComponent, AuthorizationTags } from '@loopback/authorization'
import { BindingKey } from '@loopback/core'
import { HealthComponent } from '@loopback/extension-health'
import { MetricsComponent } from '@loopback/extension-metrics'
import { RestExplorerBindings, RestExplorerComponent } from '@loopback/rest-explorer'
import { AuthComponent } from './Auth/auth.component'
import { GoatAuthorizationProvider } from './Auth/Authorization.provider'
import { Strategy } from './Auth/Strategy'
import { DataSourceComponent } from './datasources/datasource.component'
import { FormComponent } from './Form/form.component'
import { GoatSequence } from './sequence'
import { UploadsComponent } from './Uploads/uploads.component'
/**
 * Information from package.json
 */
export interface PackageInfo {
  name: string
  version: string
  description: string
}
export const PackageKey = BindingKey.create<PackageInfo>('application.package')

export const Goat = (() => {
  const boot = (app: any, pkg: PackageInfo) => {
    app.bind(PackageKey).to(pkg)

    app.component(HealthComponent)

    app.component(MetricsComponent)

    if (String(process.env.WORKER_ONLY) === 'true') {
      return
    }
    app.component(DataSourceComponent)

    app.component(AuthenticationComponent)

    app.component(AuthorizationComponent)

    app
      .bind('authorizationProviders.GoatAuthorizationProvider')
      .toProvider(GoatAuthorizationProvider)
      .tag(AuthorizationTags.AUTHORIZER)

    app.component(AuthComponent)

    Strategy.jwt(app, pkg)

    app.sequence(GoatSequence)

    app.component(FormComponent)

    app.component(UploadsComponent)

    app.bind(RestExplorerBindings.CONFIG).to({
      path: '/explorer'
    })

    app.component(RestExplorerComponent)
  }
  return Object.freeze({ boot })
})()
