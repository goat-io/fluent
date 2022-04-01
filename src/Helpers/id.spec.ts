import { Id } from './Id'
it('Should generate a uuid', () => {
  const uuid = Id.uuid()
  const pattern =
    /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

  expect(typeof uuid).toBe('string')
  expect(pattern.test(uuid)).toBe(true)
})

it('Should generate a mongo ObjectId as string', () => {
  const objectID = Id.objectIdString()
  expect(typeof objectID).toBe('string')
})

it('Should generate a nanoId', () => {
  const nanoId = Id.nanoId()
  expect(typeof nanoId).toBe('string')
  expect(nanoId.length).toBe(21)
})
