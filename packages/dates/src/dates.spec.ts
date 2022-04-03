import { Dates } from './Dates'

it('currentUnixDate - Should get the current date in unix', async () => {
  const date = Dates.currentUnixDate()
  expect(typeof date).toBe('number')
  expect(date > 1588659293).toBe(true)
})

it('currentIsoString - Should get the current date in iso string format', async () => {
  const date = Dates.currentIsoString()
  expect(typeof date).toBe('string')
  const regex =
    /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/

  expect(regex.test(date)).toBe(true)
})

it('currentDateObject - Should get the current date in dayjs Format', async () => {
  const date = Dates.currentDateObject()

  expect(date.locale()).toBe('en')
})

it('currentDateObject - Should get the current date in dayjs Format', async () => {
  const date = Dates.parseUnixDate(22588659293)

  const sameOrAfter = Dates.isSameOrAfterNow(date)

  expect(sameOrAfter).toBe(true)
})
