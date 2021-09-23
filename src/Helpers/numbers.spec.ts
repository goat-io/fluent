import { Numbers } from './Numbers'

it('Should check if a string is numeric', () => {
  expect(Numbers.isNumeric('dogs')).toBe(false)
  expect(Numbers.isNumeric('21')).toBe(true)
  expect(Numbers.isNumeric('21.2')).toBe(true)
  expect(Numbers.isNumeric('-22')).toBe(true)
  expect(Numbers.isNumeric('-21.2')).toBe(true)
  expect(Numbers.isNumeric('21-21-21')).toBe(false)
  expect(Numbers.isNumeric('21.22.22')).toBe(false)
})

it('Should conver string to Number, if possible', () => {
  expect(typeof Numbers.parseStringToNumber('dogs')).toBe('string')
  expect(typeof Numbers.parseStringToNumber('21')).toBe('number')
  expect(typeof Numbers.parseStringToNumber('21.2')).toBe('number')
  expect(typeof Numbers.parseStringToNumber('-22')).toBe('number')
  expect(typeof Numbers.parseStringToNumber('-21.2')).toBe('number')
  expect(typeof Numbers.parseStringToNumber('21-21-21')).toBe('string')
  expect(typeof Numbers.parseStringToNumber('21.22.22')).toBe('string')
})
