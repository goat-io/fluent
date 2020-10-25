import {
  Connection,
  createConnection as typeORMCreateConnection
} from 'typeorm'

interface ICreateConnection {
  type: 'mongodb' | 'firebase' | 'sqlite' | 'mysql'
  username?: string
  password?: string
  host?: string
  port?: number
  connectionName: string
  databaseName?: string
  entitiesPath?: string[] | any[]
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
  connectionName
}: ICreateConnection) => {
  if (type === 'firebase') {
    return {
      provide: connectionName,
      useFactory: async () => {
        return { type }
      }
    }
  }
  return {
    provide: connectionName,
    useFactory: async () => {
      return {
        type,
        connection: await typeORMCreateConnection({
          name: connectionName,
          type,
          username,
          password,
          host,
          port,
          database: databaseName,
          useNewUrlParser: type === 'mongodb' ? true : undefined,
          useUnifiedTopology: type === 'mongodb' ? true : undefined,
          entities: [...entitiesPath]
        })
      }
    }
  }
}
