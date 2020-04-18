import { inject } from '@loopback/core'
import { juggler } from '@loopback/repository'

const config = {
  connector: 'mongodb',
  name: 'Mongo',
  url: process.env.MONGO_URL,
  useNewUrlParser: true,
  useUnifiedTopology: true
}

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
}
