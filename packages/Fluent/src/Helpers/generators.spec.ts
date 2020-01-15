import { Generators } from './Generators'
it('Should generate a uuid', () => {
  const uuid = Generators().uuid()
  expect(typeof uuid).toBe('string')
})

it('Should generate a mongo ObjectId as string', () => {
  const objectID = Generators().objectID()
  expect(typeof objectID).toBe('string')
})
