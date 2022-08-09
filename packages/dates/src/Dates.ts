import dayjs, { Dayjs, locale } from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import DayjsweekOfYear from 'dayjs/plugin/weekOfYear'
import { Language } from './Language'

import 'dayjs/locale/es'
import 'dayjs/locale/en'
import 'dayjs/locale/fr'
import 'dayjs/locale/ar'
import 'dayjs/locale/zh'

enum supportedLanguages {
  spanish = 'es',
  english = 'en',
  french = 'fr',
  arabic = 'ar',
  chinese = 'zh'
}

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isBetween)
dayjs.extend(DayjsweekOfYear)

export const Dates = (() => {
  /**
   *
   */
  const currentUnixDate = (): number => Math.round(+new Date() / 1000)
  /**
   *
   */
  const currentIsoString = (): string => new Date().toISOString()
  /**
   *
   */
  const currentDateObject = (): Dayjs => dayjs()

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
  const parseUnixDate = (unixDate: number): Dayjs => dayjs.unix(unixDate)
  /**
   * Get a Dayjs instance given a unixDate
   * @param unixDate
   */
  const parseIsoStringDate = (isoStringDate: string): Dayjs =>
    // var d = new Date(isoStringDate)
    dayjs(isoStringDate)

  /**
   *
   * @param date
   */
  const isSameOrAfterNow = (date: Dayjs): boolean =>
    date.isSameOrAfter(dayjs(), 'millisecond')
  /**
   *
   * @param date
   */
  const isSameOrBeforeNow = (date: Dayjs): boolean =>
    date.isSameOrBefore(dayjs())
  /**
   *
   * @param date
   */
  const weekOfYear = (date: Dayjs): number => dayjs(date).week()


  const raw = dayjs

  return Object.freeze({
    changeLanguage,
    currentUnixDate,
    currentIsoString,
    currentDateObject,
    isSameOrAfterNow,
    isSameOrBeforeNow,
    setLocales,
    parseUnixDate,
    parseIsoStringDate,
    weekOfYear,
    supportedLanguages,
    raw
  })
})()
