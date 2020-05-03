import { Dayjs, locale } from 'dayjs'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import DayjsweekOfYear from 'dayjs/plugin/weekOfYear'
import { Language } from './Language'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isBetween)
dayjs.extend(DayjsweekOfYear)

export const Dates = (() => {
  /**
   *
   */
  const currentUnixDate = (): number => {
    return Math.round(+new Date() / 1000)
  }
  /**
   *
   */
  const currentIsoString = (): string => {
    return new Date().toISOString()
  }
  /**
   *
   * @param code
   */
  const changeLanguage = (code: string): void => {
    locale(code)
  }
  /**
   *
   */
  const setLocales = (): void => {
    locale(Language.get())
  }
  /**
   * Get a Dayjs instance given a unixDate
   * @param unixDate
   */
  const unix = (unixDate: number): Dayjs => {
    return dayjs(unixDate)
  }
  /**
   *
   * @param date
   */
  const isSameOrAfterNow = (date: Dayjs): boolean => {
    return dayjs().isSameOrAfter(date)
  }
  /**
   *
   * @param date
   */
  const isSameOrBeforeNow = (date: Dayjs): boolean => {
    return dayjs().isSameOrBefore(date)
  }
  /**
   *
   * @param date
   */
  const weekOfYear = (date: Dayjs): number => {
    return dayjs(date).week()
  }

  return Object.freeze({
    changeLanguage,
    currentUnixDate,
    currentIsoString,
    isSameOrAfterNow,
    isSameOrBeforeNow,
    setLocales,
    unix,
    weekOfYear
  })
})()
