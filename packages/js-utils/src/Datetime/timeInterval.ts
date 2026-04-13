// Original Source: https://github.com/NaturalCycles/js-lib/blob/master/src/datetime/timeInterval.ts

import type { UnixTimestampNumber } from '../types'
import type { Inclusiveness } from './localDate'
import type { LocalTimeConfig } from './localTime'
import { LocalTime } from './localTime'

export type TimeIntervalConfig = TimeInterval | TimeIntervalString
export type TimeIntervalString = string

/**
 * Class that supports an "interval of time" between 2 timestamps - start and end.
 * Example: `1649267185/1649267187`.
 *
 * @experimental
 */
export class TimeInterval {
  private constructor(
    private _start: UnixTimestampNumber,
    private _end: UnixTimestampNumber,
  ) {}

  static of(start: LocalTimeConfig, end: LocalTimeConfig): TimeInterval {
    return new TimeInterval(
      LocalTime.parseToUnixTimestamp(start),
      LocalTime.parseToUnixTimestamp(end),
    )
  }

  get start(): UnixTimestampNumber {
    return this._start
  }

  get end(): UnixTimestampNumber {
    return this._end
  }

  get startTime(): LocalTime {
    return LocalTime.of(this._start)
  }

  get endTime(): LocalTime {
    return LocalTime.of(this._end)
  }

  /**
   * Parses string like `1649267185/1649267187` into a TimeInterval.
   */
  static parse(d: TimeIntervalConfig): TimeInterval {
    if (d instanceof TimeInterval) {
      return d
    }

    const [start, end] = d.split('/').map(Number)

    if (!end || !start) {
      throw new Error(`Cannot parse "${d}" into TimeInterval`)
    }

    return new TimeInterval(start, end)
  }

  isSame(d: TimeIntervalConfig): boolean {
    return this.cmp(d) === 0
  }

  isBefore(d: TimeIntervalConfig, inclusive = false): boolean {
    const r = this.cmp(d)
    return r === -1 || (r === 0 && inclusive)
  }

  isSameOrBefore(d: TimeIntervalConfig): boolean {
    return this.cmp(d) <= 0
  }

  isAfter(d: TimeIntervalConfig, inclusive = false): boolean {
    const r = this.cmp(d)
    return r === 1 || (r === 0 && inclusive)
  }

  isSameOrAfter(d: TimeIntervalConfig): boolean {
    return this.cmp(d) >= 0
  }

  includes(d: LocalTimeConfig, incl: Inclusiveness = '[)'): boolean {
    const timestamp = LocalTime.parseToUnixTimestamp(d)
    if (
      timestamp < this._start ||
      (timestamp === this._start && incl[0] === '(')
    ) {
      return false
    }
    if (timestamp > this._end || (timestamp === this._end && incl[1] === ')')) {
      return false
    }
    return true
  }

  /**
   * TimeIntervals compare by start date.
   * If it's the same - then by end date.
   */
  cmp(d: TimeIntervalConfig): -1 | 0 | 1 {
    const interval = TimeInterval.parse(d)
    if (this._start > interval._start) {
      return 1
    }
    if (this._start < interval._start) {
      return -1
    }
    if (this._end > interval._end) {
      return 1
    }
    if (this._end < interval._end) {
      return -1
    }
    return 0
  }

  toString(): TimeIntervalString {
    return [this._start, this._end].join('/')
  }

  toJSON(): TimeIntervalString {
    return this.toString()
  }
}
