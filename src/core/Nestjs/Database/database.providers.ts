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
        entities: [
          __dirname + '/../Form/*.entity{.ts,.js}',
          __dirname + '/../Auth/Role/*.entity{.ts,.js}'
        ]
      })
  }
]
