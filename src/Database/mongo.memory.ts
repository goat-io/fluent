import { MongoMemoryServer } from 'mongodb-memory-server'
import { createConnection, Schema } from 'mongoose'
import { Log } from '../Log/Logger'

export interface MemoryMongo {
  url: string
  port: number
  dbName: string
  instance: MongoMemoryServer
}

export const mongoMemory = (() => {
  /**
   * Creates an arbitrary collection to
   * keep alive the test db
   * @param {*} url mongoDB connection URL
   */
  const createExampleSchema = (url: string) => {
    return new Promise((resolve: any, reject: any) => {
      const db = createConnection(url)

      const testSchema = new Schema({
        age: Number,
        name: String
      })

      const Test = db.model('test', testSchema)

      const test = new Test({ name: 'Nacho', age: 31 })

      db.once('connected', (err: any) => {
        if (err) {
          return Log.error(err)
        }
        Test.create(test, (error: any, doc: any) => {
          if (err) {
            return Log.error(error)
          }
          resolve(doc)
          return
        })
      })
    })
  }

  /**
   * Starts a new MongoDB instance
   */
  const start = async (): Promise<MemoryMongo> => {
    const mongoServer = new MongoMemoryServer()
    const url = await mongoServer.getConnectionString()
    const port = await mongoServer.getPort()
    const dbName = await mongoServer.getDbName()

    await createExampleSchema(url)

    return {
      dbName,
      instance: mongoServer,
      port,
      url
    }
  }

  return Object.freeze({
    start
  })
})()
