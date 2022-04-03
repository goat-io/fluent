import { Arrays } from './Arrays'

it('Should get last element of array', () => {
  const arr = [100, 200, 300, 110]
  const last = Arrays.last(arr)
  expect(last).toBe(110)
})

it('Should get first element of array', () => {
  const arr = [100, 200, 300, 110]
  const last = Arrays.first(arr)
  expect(last).toBe(100)
})

it('Should get the default value', () => {
  const arr = []
  const last = Arrays.last(arr, 'hello')
  expect(last).toBe('hello')
})
