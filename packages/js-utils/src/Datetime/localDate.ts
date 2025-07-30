// Original Source: https://github.com/NaturalCycles/js-lib/blob/master/src/datetime/localDate.ts

import { assert } from '../Assert'
import type {
  IsoDateString,
  IsoDateTimeString,
  UnixTimestampMillisNumber,
  UnixTimestampNumber
} from '../types'
import { LocalTime } from './localTime'

export type LocalDateUnit = LocalDateUnitStrict | 'week'
export type LocalDateUnitStrict = 'year' | 'month' | 'day'
export type Inclusiveness = '()' | '[]' | '[)' | '(]'

const MDAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/

export type LocalDateConfig = LocalDate | IsoDateString
export type LocalDateFormatter = (ld: LocalDate) => string

/* eslint-disable no-dupe-class-members */

/**
 * @experimental
 */
export class LocalDate {
  private constructor(
    private _year: number,
    private _month: number,
    private _day: number
  ) {}

  static create(year: number, month: number, day: number): LocalDate {
    return new LocalDate(year, month, day)
  }

  /**
   * Parses input String into LocalDate.
   * Input can already be a LocalDate - it is returned as-is in that case.
   */
  static of(d: LocalDateConfig): LocalDate {
    const t = LocalDate.parseOrNull(d)

    if (t === null) {
      throw new Error(`Cannot parse "${d}" into LocalDate`)
    }

    return t
  }

  static parseCompact(d: string): LocalDate {
    const [year, month, day] = [
      d.slice(0, 4),
      d.slice(4, 2),
      d.slice(6, 2)
    ].map(Number)

    if (!day || !month || !year) {
      throw new Error(`Cannot parse "${d}" into LocalDate`)
    }

    return new LocalDate(year, month, day)
  }

  static fromDate(d: Date): LocalDate {
    return new LocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }

  static fromDateUTC(d: Date): LocalDate {
    return new LocalDate(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate()
    )
  }

  /**
   * Returns null if invalid.
   */
  static parseOrNull(d: LocalDateConfig | undefined | null): LocalDate | null {
    if (!d) {
      return null
    }
    if (d instanceof LocalDate) {
      return d
    }

    // const [year, month, day] = d.slice(0, 10).split('-').map(Number)
    const matches = DATE_REGEX.exec(d.slice(0, 10))
    if (!matches) {
      return null
    }

    const year = Number(matches[1])
    const month = Number(matches[2])
    const day = Number(matches[3])

    if (
      !year ||
      !month ||
      month < 1 ||
      month > 12 ||
      !day ||
      day < 1 ||
      day > LocalDate.getMonthLength(year, month)
    ) {
      return null
    }

    return new LocalDate(year, month, day)
  }

  // Can use just .toString()
  // static parseToString(d: LocalDateConfig): IsoDateString {
  //   return typeof d === 'string' ? d : d.toString()
  // }

  static isValid(iso: string | undefined | null): boolean {
    return LocalDate.parseOrNull(iso) !== null
  }

  static today(): LocalDate {
    return LocalDate.fromDate(new Date())
  }

  static todayUTC(): LocalDate {
    return LocalDate.fromDateUTC(new Date())
  }

  static sort(
    items: LocalDate[],
    mutate = false,
    descending = false
  ): LocalDate[] {
    const mod = descending ? -1 : 1
    return (mutate ? items : [...items]).sort((a, b) => a.cmp(b) * mod)
  }

  static earliestOrUndefined(items: LocalDateConfig[]): LocalDate | undefined {
    return items.length ? LocalDate.earliest(items) : undefined
  }

  static earliest(items: LocalDateConfig[]): LocalDate {
    assert(items.length, 'LocalDate.earliest called on empty array')

    return items
      .map(i => LocalDate.of(i))
      .reduce((min, item) => (min.isSameOrBefore(item) ? min : item))
  }

  static latestOrUndefined(items: LocalDateConfig[]): LocalDate | undefined {
    return items.length ? LocalDate.latest(items) : undefined
  }

  static latest(items: LocalDateConfig[]): LocalDate {
    assert(items.length, 'LocalDate.latest called on empty array')

    return items
      .map(i => LocalDate.of(i))
      .reduce((max, item) => (max.isSameOrAfter(item) ? max : item))
  }

  static range(
    min: LocalDateConfig,
    max: LocalDateConfig,
    incl: Inclusiveness = '[)',
    step = 1,
    stepUnit: LocalDateUnit = 'day'
  ): LocalDate[] {
    let actualStep = step
    const actualStepUnit: LocalDateUnitStrict =
      stepUnit === 'week' ? 'day' : stepUnit
    if (stepUnit === 'week') {
      actualStep = step * 7
    }

    const dates: LocalDate[] = []
    const Min = LocalDate.of(min)
    const Max = LocalDate.of(max).startOf(actualStepUnit)

    let current = Min.startOf(actualStepUnit)
    if (current.isAfter(Min, incl[0] === '[')) {
      // ok
    } else {
      current.add(1, actualStepUnit, true)
    }

    const incl2 = incl[1] === ']'
    while (current.isBefore(Max, incl2)) {
      dates.push(current)
      current = current.add(actualStep, actualStepUnit)
    }

    return dates
  }

  get(unit: LocalDateUnitStrict): number {
    return unit === 'year'
      ? this._year
      : unit === 'month'
        ? this._month
        : this._day
  }

  set(unit: LocalDateUnitStrict, v: number, mutate = false): LocalDate {
    const t = mutate ? this : this.clone()

    if (unit === 'year') {
      t._year = v
    } else if (unit === 'month') {
      t._month = v
    } else {
      t._day = v
    }

    return t
  }

  year(): number
  year(v: number): LocalDate
  year(v?: number): number | LocalDate {
    return v === undefined ? this._year : this.set('year', v)
  }
  month(): number
  month(v: number): LocalDate
  month(v?: number): number | LocalDate {
    return v === undefined ? this._month : this.set('month', v)
  }
  day(): number
  day(v: number): LocalDate
  day(v?: number): number | LocalDate {
    return v === undefined ? this._day : this.set('day', v)
  }

  isSame(d: LocalDateConfig): boolean {
    const date = LocalDate.of(d)
    return (
      this._day === date._day &&
      this._month === date._month &&
      this._year === date._year
    )
  }

  isBefore(d: LocalDateConfig, inclusive = false): boolean {
    const r = this.cmp(d)
    return r === -1 || (r === 0 && inclusive)
  }

  isSameOrBefore(d: LocalDateConfig): boolean {
    return this.cmp(d) <= 0
  }

  isAfter(d: LocalDateConfig, inclusive = false): boolean {
    const r = this.cmp(d)
    return r === 1 || (r === 0 && inclusive)
  }

  isSameOrAfter(d: LocalDateConfig): boolean {
    return this.cmp(d) >= 0
  }

  isBetween(
    min: LocalDateConfig,
    max: LocalDateConfig,
    incl: Inclusiveness = '[)'
  ): boolean {
    let r = this.cmp(min)
    if (r < 0 || (r === 0 && incl[0] === '(')) {
      return false
    }
    r = this.cmp(max)
    if (r > 0 || (r === 0 && incl[1] === ')')) {
      return false
    }
    return true
  }

  /**
   * Returns 1 if this > d
   * returns 0 if they are equal
   * returns -1 if this < d
   */
  cmp(d: LocalDateConfig): -1 | 0 | 1 {
    const date = LocalDate.of(d)
    if (this._year < date._year) {
      return -1
    }
    if (this._year > date._year) {
      return 1
    }
    if (this._month < date._month) {
      return -1
    }
    if (this._month > date._month) {
      return 1
    }
    if (this._day < date._day) {
      return -1
    }
    if (this._day > date._day) {
      return 1
    }
    return 0
  }

  /**
   * Same as Math.abs( diff )
   */
  absDiff(d: LocalDateConfig, unit: LocalDateUnit): number {
    return Math.abs(this.diff(d, unit))
  }

  /**
   * Returns the number of **full** units difference (aka `Math.floor`).
   *
   * a.diff(b) means "a minus b"
   */
  diff(d: LocalDateConfig, unit: LocalDateUnit): number {
    const date = LocalDate.of(d)

    const sign = this.cmp(date)
    if (!sign) {
      return 0
    }

    // Put items in descending order: "big minus small"
    const [big, small] = sign === 1 ? [this, date] : [date, this]

    if (unit === 'year') {
      let years = big._year - small._year

      if (
        big._month < small._month ||
        (big._month === small._month &&
          big._day < small._day &&
          !(
            big._day === LocalDate.getMonthLength(big._year, big._month) &&
            small._day === LocalDate.getMonthLength(small._year, small._month)
          ))
      ) {
        years--
      }

      return years * sign || 0
    }

    if (unit === 'month') {
      let months = (big._year - small._year) * 12 + (big._month - small._month)
      if (big._day < small._day) {
        const bigMonthLen = LocalDate.getMonthLength(big._year, big._month)
        if (big._day !== bigMonthLen || small._day < bigMonthLen) {
          months--
        }
      }
      return months * sign || 0
    }

    // unit is 'day' or 'week'
    let days = big._day - small._day

    // If small date is after 1st of March - next year's "leapness" should be used
    const offsetYear = small._month >= 3 ? 1 : 0
    for (let year = small._year; year < big._year; year++) {
      days += LocalDate.getYearLength(year + offsetYear)
    }

    if (small._month < big._month) {
      for (let month = small._month; month < big._month; month++) {
        days += LocalDate.getMonthLength(big._year, month)
      }
    } else if (big._month < small._month) {
      for (let month = big._month; month < small._month; month++) {
        days -= LocalDate.getMonthLength(big._year, month)
      }
    }

    if (unit === 'week') {
      return Math.trunc(days / 7) * sign || 0
    }

    return days * sign || 0
  }

  add(num: number, unit: LocalDateUnit, mutate = false): LocalDate {
    let { _day, _month, _year } = this
    let actualNum = num
    let actualUnit = unit

    if (unit === 'week') {
      actualNum = num * 7
      actualUnit = 'day'
    }

    if (actualUnit === 'day') {
      _day += actualNum
    } else if (actualUnit === 'month') {
      _month += actualNum
    } else if (actualUnit === 'year') {
      _year += actualNum
    }

    // check month overflow
    while (_month > 12) {
      _year += 1
      _month -= 12
    }
    while (_month < 1) {
      _year -= 1
      _month += 12
    }

    // check day overflow
    // Applies not only for 'day' unit, but also e.g 2022-05-31 plus 1 month should be 2022-06-30 (not 31!)
    if (_day < 1) {
      while (_day < 1) {
        _month -= 1
        if (_month < 1) {
          _year -= 1
          _month += 12
        }

        _day += LocalDate.getMonthLength(_year, _month)
      }
    } else {
      let monLen = LocalDate.getMonthLength(_year, _month)

      if (unit !== 'day') {
        if (_day > monLen) {
          // Case of 2022-05-31 plus 1 month should be 2022-06-30, not 31
          _day = monLen
        }
      } else {
        while (_day > monLen) {
          _day -= monLen
          _month += 1
          if (_month > 12) {
            _year += 1
            _month -= 12
          }

          monLen = LocalDate.getMonthLength(_year, _month)
        }
      }
    }

    if (mutate) {
      this._year = _year
      this._month = _month
      this._day = _day
      return this
    }

    return new LocalDate(_year, _month, _day)
  }

  subtract(num: number, unit: LocalDateUnit, mutate = false): LocalDate {
    return this.add(-num, unit, mutate)
  }

  startOf(unit: LocalDateUnitStrict): LocalDate {
    if (unit === 'day') {
      return this
    }
    if (unit === 'month') {
      return LocalDate.create(this._year, this._month, 1)
    }
    // year
    return LocalDate.create(this._year, 1, 1)
  }

  endOf(unit: LocalDateUnitStrict): LocalDate {
    if (unit === 'day') {
      return this
    }
    if (unit === 'month') {
      return LocalDate.create(
        this._year,
        this._month,
        LocalDate.getMonthLength(this._year, this._month)
      )
    }
    // year
    return LocalDate.create(this._year, 12, 31)
  }

  static getYearLength(year: number): number {
    return LocalDate.isLeapYear(year) ? 366 : 365
  }

  static getMonthLength(year: number, month: number): number {
    if (month === 2) {
      return LocalDate.isLeapYear(year) ? 29 : 28
    }
    return MDAYS[month]!
  }

  static isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  }

  clone(): LocalDate {
    return new LocalDate(this._year, this._month, this._day)
  }

  /**
   * Converts LocalDate into instance of Date.
   * Year, month and day will match.
   * Hour, minute, second, ms will be 0.
   * Timezone will match local timezone.
   */
  toDate(): Date {
    return new Date(this._year, this._month - 1, this._day)
  }

  toLocalTime(): LocalTime {
    return LocalTime.of(this.toDate())
  }

  toISODate(): IsoDateString {
    return this.toString()
  }

  /**
   * Returns e.g: `1984-06-21T17:56:21`
   */
  toISODateTime(): IsoDateTimeString {
    return `${this.toString()}T00:00:00`
  }

  toString(): IsoDateString {
    return [
      String(this._year).padStart(4, '0'),
      String(this._month).padStart(2, '0'),
      String(this._day).padStart(2, '0')
    ].join('-')
  }

  toStringCompact(): string {
    return [
      String(this._year).padStart(4, '0'),
      String(this._month).padStart(2, '0'),
      String(this._day).padStart(2, '0')
    ].join('')
  }

  // May be not optimal, as LocalTime better suits it
  unix(): UnixTimestampNumber {
    return Math.floor(this.toDate().valueOf() / 1000)
  }

  unixMillis(): UnixTimestampMillisNumber {
    return this.toDate().valueOf()
  }

  toJSON(): IsoDateString {
    return this.toString()
  }

  format(fmt: LocalDateFormatter): string {
    return fmt(this)
  }
}

/**
 * Shortcut wrapper around `LocalDate.parse` / `LocalDate.today`
 */
export function localDate(d?: LocalDateConfig): LocalDate {
  return d ? LocalDate.of(d) : LocalDate.today()
}
