/**
 * Allows to define error-controlling behaviour for batch operations.
 *  Reference: https://github.com/NaturalCycles/js-lib/blob/master/src/error/errorMode.ts
 * @default is THROW_IMMEDIATELY in most cases
 */
export enum ErrorMode {
  /**
   * Usually a default behaviour, similar as "exit early".
   */
  ThrowImmediately = 'THROW_IMMEDIATELY',

  /**
   * Don't throw on errors, but collect them and throw as AggregatedError in the end.
   */
  ThrowAggregated = 'THROW_AGGREGATED',

  /**
   * Completely suppress errors, do not aggregate nor throw anything. Resilient mode.
   */
  Suppress = 'SUPPRESS',
}
