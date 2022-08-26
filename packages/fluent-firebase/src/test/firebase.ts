import startContainer, {
    Options as WithContainerOptions,
    killOldContainers
  } from '@goatlab/fluent/src/TypeOrmConnector/test/docker/docker'
  import { MongoClient } from 'mongodb'
  
  const DEFAULT_IMAGE = 'mongo:6.0.1'
  const DEFAULT_CONTAINER_NAME = `fluent-${DEFAULT_IMAGE.replace(':', '-')}-test`
  const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10
  const DEFAULT_MONGO_PORT = 27017
  const DEFAULT_MONGO_USER = 'test-user'
  const DEFAULT_MONGO_PASSWORD = 'password'
  const DEFAULT_MONGO_DB = 'test-db'
  const DEFAULT_MONGO_DEBUG = false
  
  export interface Options
    extends Omit<
      WithContainerOptions,
      'internalPort' | 'enableDebugInstructions' | 'testConnection'
    > {
    mongoUser: string
    mongoPassword: string
    mongoDb: string
  }
  
  export async function waitForConnection(
    databaseURL: string,
    timeoutSeconds: number
  ) {
    const start = Date.now()
    const timeoutMilliseconds = timeoutSeconds * 1000
    let lastAttempt = false
  
    while (true) {
      await new Promise<void>(resolve => setTimeout(resolve, 1000))
      const conn = new MongoClient(databaseURL)
  
      try {
        try {
          // Attempt to connect
          await conn.connect()
  
          const db = conn.db('anyDB')
  
          // Once connected, we try to do something
          const result = await db.command({
            ping: 1
          })
       
          // If we have a result, the DB is running
          if (result.ok) {
            break
          } else {
            if (lastAttempt) {
              throw new Error('Got unexpected result: ' + JSON.stringify(result))
            }
          }
        } catch (ex) {
          console.log(ex)
          if (lastAttempt) {
            throw ex
          }
        }
      } finally {
        // We kill the connection
        await conn.close()
      }
      if (Date.now() - timeoutMilliseconds > start) {
        lastAttempt = true
      }
    }
  }
  
  export default async function getDatabase(options: Partial<Options> = {}) {
    const {
      mongoUser,
      mongoPassword,
      mongoDb,
      environment,
      ...rawOptions
    }: Options = {
      debug: DEFAULT_MONGO_DEBUG,
      image: DEFAULT_IMAGE,
      containerName: DEFAULT_CONTAINER_NAME,
      connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
      mongoUser: DEFAULT_MONGO_USER,
      mongoPassword: DEFAULT_MONGO_PASSWORD,
      mongoDb: DEFAULT_MONGO_DB,
      defaultExternalPort: DEFAULT_MONGO_PORT,
      // externalPort: config.test.port,
      ...options
    }
  
    const { proc, externalPort, kill } = await startContainer({
      ...rawOptions,
      internalPort: DEFAULT_MONGO_PORT,
      environment: {
        MONGO_HOST: '127.0.0.1',
        ...environment,
        MONGO_INITDB_ROOT_USERNAME: mongoUser,
        MONGO_INITDB_ROOT_PASSWORD: mongoPassword,
        MONGO_DB_USER: mongoUser,
        MONGO_DB_PASSWORD: mongoPassword,
        MONGO_PASSWORD: mongoPassword,
        MONGO_INITDB_DATABASE: mongoDb
      },
      enableDebugInstructions: `To view logs, run with MONGO_TEST_DEBUG=true environment variable.`
    })
  
    const databaseURL = `mongodb://${mongoUser}:${mongoPassword}@localhost:${externalPort}`
  
    await waitForConnection(databaseURL, rawOptions.connectTimeoutSeconds)
  
    return {
      proc,
      databaseURL,
      kill,
      user: mongoUser,
      password: mongoPassword,
      port: externalPort,
      dbName: mongoDb
    }
  }
  