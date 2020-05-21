import { createConnection } from 'typeorm'

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
  }
]
