import { FirebaseInit } from '../../Providers/Firebase/FirebaseInit'
import {
  Connection,
  createConnection as typeORMCreateConnection,
  getConnection
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
  synchronize?: boolean
  logging?: boolean
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
  synchronize,
  logging
}: ICreateConnection) => {
  if (type === 'firebase') {
    if (process.env.DATABASE_FIREBASE_NAME) {
      try {
        FirebaseInit({
          host: process.env.DATABASE_FIREBASE_HOST || undefined,
          port: Number(process.env.DATABASE_FIREBASE_PORT) || undefined,
          databaseName: process.env.DATABASE_FIREBASE_NAME,
          serviceAccountPath: process.env.DATABASE_FIREBASE_SERVICE_ACCOUNT_PATH
        })
      } catch (error) {
        throw error
      }
    }

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
      let connection: Connection | undefined
      try {
        connection = getConnection('connectionName')
      } catch (error) {
        connection = await typeORMCreateConnection({
          name: connectionName,
          type,
          username,
          password,
          host,
          port,
          database: databaseName,
          useNewUrlParser: type === 'mongodb' ? true : undefined,
          useUnifiedTopology: type === 'mongodb' ? true : undefined,
          entities: [...entitiesPath],
          synchronize,
          logging
        })
      }

      return {
        type,
        connection
      }
    }
  }
}
