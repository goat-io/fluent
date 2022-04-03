import { Database } from './Database'

test('Should start a MONGODB database', async () => {
  jest.setTimeout(30000)
  const container = await Database.mongo()
  console.log({ container })
  await new Promise(resolve => setTimeout(resolve, 10000))

  await container.remove()

  expect(true).toBe(true)
})
