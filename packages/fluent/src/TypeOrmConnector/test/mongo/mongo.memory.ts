import { MongoMemoryServer } from 'mongodb-memory-server'
import { createConnection, Schema } from 'mongoose'

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
          return console.error(err)
        }
        Test.create(test, (error: any, doc: any) => {
          if (err) {
            return console.error(error)
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
  const start = async (): Promise<MongoMemoryServer> => {

    const mongoServer = await MongoMemoryServer.create({
        instance: {
            storageEngine: 'wiredTiger'
        }
    });
    const url = mongoServer.getUri()

    await createExampleSchema(url)

    return mongoServer
  }

  return Object.freeze({
    start
  })
})()