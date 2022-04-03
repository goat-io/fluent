import { DataSource } from 'typeorm'

interface ConnectionOptions {
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

export interface FluentConnectionFactory {
  type: 'mongodb' | 'firebase' | 'sqlite' | 'mysql'
  connection?: DataSource
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
}: ConnectionOptions) => {
  if (type === 'firebase') {
    /** 
    if (false) {
      FirebaseInit({
        host: process.env.DATABASE_FIREBASE_HOST || undefined,
        port: Number(process.env.DATABASE_FIREBASE_PORT) || undefined,
        databaseName: process.env.DATABASE_FIREBASE_NAME,
        serviceAccountPath: process.env.DATABASE_FIREBASE_SERVICE_ACCOUNT_PATH
      })
    }
    */

    return {
      provide: connectionName,
      useFactory: async () => ({ type })
    }
  }

  return {
    provide: connectionName,
    useFactory: async () => {
      const dataSource = new DataSource({
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

      if (dataSource.isInitialized) {
        return {
          type,
          connection: dataSource
        }
      }

      const connection = await dataSource.initialize()

      return {
        type,
        connection
      }
    }
  }
}
