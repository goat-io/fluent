import { createConnection } from 'typeorm'
import * as admin from 'firebase-admin'
import * as fireorm from 'fireorm'

export const Databases = [
  {
    provide: 'SQLITE3',
    useFactory: async () =>
      await createConnection({
        type: 'sqlite',
        database: 'src/goat.db',
        synchronize: true,
        logging: false,
        entities: [__dirname + '/../Form/*.entity{.ts,.js}']
      })
  },
  {
    provide: 'MONGO',
    useFactory: async () => {
      const url = process.env.MONGO_URL
      return createConnection({
        type: 'mongodb',
        url,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        entities: [__dirname + '/../Auth/User/*.entity{.ts,.js}']
      })
    }
  },
  {
    provide: 'FIREBASE',
    useFactory: async () => {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

      const app = admin.initializeApp({
        projectId: 'test',
        credential: admin.credential.applicationDefault()
      })

      const firestore = app.firestore()
      fireorm.initialize(firestore)
    }
  }
]
