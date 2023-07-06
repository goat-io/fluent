import { ObjectIds } from './ObjectIds'

it('Should generate a mongo ObjectId as string', async () => {
  const objectID = await ObjectIds.getString()
  expect(typeof objectID).toBe('string')
})
