import {
  createConnection as typeORMCreateConnection,
  Connection
} from 'typeorm'

interface ICreateConnection {
  type: 'mongodb' | 'firebase' | 'sqlite' | 'mysql'
  username?: string
  password?: string
  host?: string
  port?: number
  connectionName: string
  databaseName?: string
  entitiesPath?: string[]
  serviceAccountPath?: string
}

export interface IConnectionFactory {
  type: 'mongodb' | 'firebase' | 'sqlite' | 'mysql'
  connection?: Connection
}

export const createConnection = ({
  type,
  username,
  password,
  host,
  port,
  databaseName,
  entitiesPath,
  connectionName,
  serviceAccountPath
}: ICreateConnection) => {
  if (type === 'firebase') {
    return {
      provide: connectionName,
      useFactory: async () => {
        // createFirebaseRepository()
        return { type }
      }
    }
  }
  return {
    provide: connectionName,
    useFactory: () => {
      return {
        type,
        connection: typeORMCreateConnection({
          type,
          username,
          password,
          host,
          port,
          database: databaseName,
          useNewUrlParser: type === 'mongodb' ? true : undefined,
          useUnifiedTopology: type === 'mongodb' ? true : undefined,
          entities: [
            ...entitiesPath,
            `${__dirname}/../Auth/User/*.entity{.ts,.js}`
          ]
        })
      }
    }
  }
}
