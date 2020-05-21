import { Database } from './Database'

test('Should start a mysql database', async () => {
  await Database.mysql()
})
