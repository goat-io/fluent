import { inject, lifeCycleObserver, LifeCycleObserver, ValueOrPromise } from '@loopback/core'
import { juggler } from '@loopback/repository'

const config = {
  connector: 'memory',
  file: './src/forms.json',
  localStorage: '',
  name: 'forms'
}

@lifeCycleObserver('datasource')
export class FormsDataSource extends juggler.DataSource implements LifeCycleObserver {
  public static dataSourceName = 'forms'

  constructor(
    @inject('datasources.config.forms', { optional: true })
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
