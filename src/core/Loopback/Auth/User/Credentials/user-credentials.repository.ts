import { inject } from '@loopback/core'
import { DefaultCrudRepository, juggler } from '@loopback/repository'
import { UserCredentials, UserCredentialsRelations } from './user-credentials.model'

export class UserCredentialsRepository extends DefaultCrudRepository<
  UserCredentials,
  typeof UserCredentials.prototype._id,
  UserCredentialsRelations
> {
  constructor(@inject('datasources.mongo') dataSource: juggler.DataSource) {
    super(UserCredentials, dataSource)
  }
}
