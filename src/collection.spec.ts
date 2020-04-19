import { Fluent } from './Fluent'

it('Should create a Collection given an array', () => {
  const collection = Fluent.collect([1, 2, 3])
  expect(collection.avg()).toBe(2)
})
