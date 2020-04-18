import { Id } from './Id'
it('Should generate a uuid', () => {
  const uuid = Id.uuid()
  expect(typeof uuid).toBe('string')
})

it('Should generate a mongo ObjectId as string', () => {
  const objectID = Id.objectID()
  expect(typeof objectID).toBe('string')
})
