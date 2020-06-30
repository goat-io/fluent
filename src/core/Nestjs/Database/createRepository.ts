import { IConnectionFactory } from './createConnection'
import { Repository } from 'typeorm'
import { createFirebaseRepository } from '../../../Providers/Firebase/FirebaseConnector'
export interface IConnectRepository {
  connectionName: string
  repositoryName: string
  entity: any
}

export interface IRepository<T = any> {
  type: 'mongodb' | 'firebase' | 'sqlite' | 'mysql'
  repository?: Repository<T> | any
}

export const createRepository = ({
  connectionName,
  repositoryName,
  entity
}: IConnectRepository) => {
  return {
    provide: repositoryName,
    useFactory: async (
      dbConnection: IConnectionFactory
    ): Promise<IRepository> => {
      if (dbConnection.type === 'firebase') {
        const repository = await createFirebaseRepository(entity)
        return {
          type: 'firebase',
          repository
        }
      }

      const conn = await dbConnection.connection

      return {
        type: dbConnection.type,
        repository: conn.getRepository(entity)
      }
    },
    inject: [connectionName]
  }
}
