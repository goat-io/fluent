import { inject, lifeCycleObserver, LifeCycleObserver, ValueOrPromise } from '@loopback/core'
import { juggler } from '@loopback/repository'

const config = {
  connector: 'memory',
  file: './src/roles.json',
  localStorage: '',
  name: 'roles'
}

@lifeCycleObserver('datasource')
export class RoleDataSource extends juggler.DataSource implements LifeCycleObserver {
  public static dataSourceName = 'roles'

  constructor(
    @inject('datasources.config.roles', { optional: true })
    dsConfig: any = config
  ) {
    if (process.env.NODE_ENV === 'test') {
      delete dsConfig.file
      delete dsConfig.localStorage
    }
    super(dsConfig)
  }

  /**
   * Start the datasource when application is started
   */
  start(): ValueOrPromise<void> {
    // Add your logic here to be invoked when the application is started
  }

  /**
   * Disconnect the datasource when application is stopped. This allows the
   * application to be shut down gracefully.
   */
  stop(): ValueOrPromise<void> {
    return super.disconnect()
  }
}
