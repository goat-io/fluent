import { inject, lifeCycleObserver, ValueOrPromise } from '@loopback/core'
import { juggler } from '@loopback/repository'

const config = {
  connector: 'mongodb',
  name: 'Mongo',
  url: process.env.MONGO_URL,
  useNewUrlParser: true,
  useUnifiedTopology: true
}

@lifeCycleObserver('datasource')
export class MongoDataSource extends juggler.DataSource {
  public static dataSourceName = 'mongo'

  constructor(
    @inject('datasources.config.mongo', {
      optional: true,
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    dsConfig: object = config
  ) {
    super(dsConfig)
  }
  /**
   * Disconnect the datasource when application is stopped. This allows the
   * application to be shut down gracefully.
   */
  public stop(): void | PromiseLike<void> {
    return super.disconnect()
  }
}
