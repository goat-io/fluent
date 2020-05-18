import { Connection } from 'typeorm'
import { User } from './user.entity'

export const UserProviders = [
  {
    provide: 'USER_REPOSITORY',
    useFactory: (connection: Connection) => connection.getRepository(User),
    inject: ['MONGO']
  }
]
