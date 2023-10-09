import { Transform } from 'node:stream'
import { inspect, InspectOptions } from 'node:util'
import { bold, grey, white, yellow } from 'kleur'
import { TransformOptions, TransformTyped } from '../streams.model'
import {
  AnyObject,
  CommonLogger,
  LocalTime,
  Numbers,
  Time,
  Units,
} from '@goatlab/js-utils'
import { SimpleMovingAverage } from '../math/sma'
import { SizeStack } from '../sizeStack'

export interface TransformLogProgressOptions<IN = any>
  extends TransformOptions {
  /**
   * Progress metric
   *
   * @default `progress`
   */
  metric?: string

  /**
   * Include `heapUsed` in log.
   *
   * @default false
   */
  heapUsed?: boolean

  /**
   * Include `heapTotal` in log.
   *
   * @default false
   */
  heapTotal?: boolean

  /**
   * Include `rss` in log.
   *
   * @default true
   */
  rss?: boolean

  /**
   * Incude Peak RSS in log.
   *
   * @default true
   */
  peakRSS?: boolean

  /**
   * Include `external` in log.
   *
   * @default false
   */
  external?: boolean

  /**
   * Include `arrayBuffers` in log.
   *
   * @default false
   */
  arrayBuffers?: boolean

  /**
   * Log (rss - heapTotal)
   * For convenience of debugging "out-of-heap" memory size.
   *
   * @default false
   */
  rssMinusHeap?: boolean

  /**
   * Log "rows per second"
   *
   * @default true
   */
  logRPS?: boolean

  /**
   * Set to false to disable logging progress
   *
   * @default true
   */
  logProgress?: boolean

  /**
   * Log progress event Nth record that is _processed_ (went through mapper).
   * Set to 0 to disable logging.
   *
   * @default 1000
   */
  logEvery?: number

  logger?: CommonLogger

  /**
   * Function to return extra properties to the "progress object".
   *
   * chunk is undefined for "final" stats, otherwise is defined.
   */
  extra?: (chunk: IN | undefined, index: number) => AnyObject

  /**
   * If specified - will multiply the counter by this number.
   * Useful e.g when using `transformBuffer({ batchSize: 500 })`, so
   * it'll accurately represent the number of processed entries (not batches).
   *
   * Defaults to 1.
   */
  batchSize?: number

  /**
   * Experimental logging of item (shunk) sizes, when json-stringified.
   *
   * Defaults to false.
   *
   * @experimental
   */
  logSizes?: boolean

  /**
   * How many last item sizes to keep in a buffer, to calculate stats (p50, p90, avg, etc).
   * Defaults to 100_000.
   * Cannot be Infinity.
   */
  logSizesBuffer?: number

  /**
   * Works in addition to `logSizes`. Adds "zipped sizes".
   *
   * @experimental
   */
  logZippedSizes?: boolean
}

interface LogItem extends AnyObject {
  heapUsed?: number
  heapTotal?: number
  rss?: number
  peakRSS?: number
  rssMinusHeap?: number
  external?: number
  arrayBuffers?: number
  rps10?: number
  rpsTotal?: number
}

const inspectOpt: InspectOptions = {
  colors: true,
  breakLength: 300,
}

/**
 * Pass-through transform that optionally logs progress.
 */
export function transformLogProgress<IN = any>(
  opt: TransformLogProgressOptions = {},
): TransformTyped<IN, IN> {
  const {
    metric = 'progress',
    heapTotal: logHeapTotal = false,
    heapUsed: logHeapUsed = false,
    rss: logRss = true,
    peakRSS: logPeakRSS = true,
    logRPS = true,
    logEvery = 1000,
    logSizes = false,
    logSizesBuffer = 100_000,
    logZippedSizes = false,
    batchSize = 1,
    extra,
    logger = console,
  } = opt
  const logProgress = opt.logProgress !== false && logEvery !== 0 // true by default
  const logEvery10 = logEvery * 10

  const started = Date.now()
  let lastSecondStarted = Date.now()

  const sma = new SimpleMovingAverage(10) // over last 10 seconds
  let processedLastSecond = 0
  let progress = 0
  let peakRSS = 0

  const sizes = logSizes ? new SizeStack('json', logSizesBuffer) : undefined
  const sizesZipped = logZippedSizes
    ? new SizeStack('json.gz', logSizesBuffer)
    : undefined

  logStats() // initial

  return new Transform({
    objectMode: true,
    ...opt,
    transform(chunk: IN, _, cb) {
      progress++
      processedLastSecond++

      if (sizes) {
        // Check it, cause gzipping might be delayed here..
        void SizeStack.countItem(chunk, logger, sizes, sizesZipped)
      }

      if (logProgress && progress % logEvery === 0) {
        logStats(chunk, false, progress % logEvery10 === 0)
      }

      cb(null, chunk) // pass-through
    },
    final(cb) {
      logStats(undefined, true)

      cb()
    },
  })

  function logStats(chunk?: IN, final = false, tenx = false): void {
    if (!logProgress) return

    const mem = process.memoryUsage()

    const now = Date.now()
    const batchedProgress = progress * batchSize
    const lastRPS =
      (processedLastSecond * batchSize) / ((now - lastSecondStarted) / 1000) ||
      0
    const rpsTotal = Math.round(batchedProgress / ((now - started) / 1000)) || 0
    lastSecondStarted = now
    processedLastSecond = 0

    const rps10 = Math.round(sma.pushGetAvg(lastRPS))
    if (mem.rss > peakRSS) peakRSS = mem.rss

    const o: LogItem = {
      [final ? `${metric}_final` : metric]: batchedProgress,
    }

    if (extra) Object.assign(o, extra(chunk, progress))
    if (logHeapUsed) o.heapUsed = Units.megaBytes(mem.heapUsed)
    if (logHeapTotal) o.heapTotal = Units.megaBytes(mem.heapTotal)
    if (logRss) o.rss = Units.megaBytes(mem.rss)
    if (logPeakRSS) o.peakRSS = Units.megaBytes(peakRSS)
    if (opt.rssMinusHeap)
      o.rssMinusHeap = Units.megaBytes(mem.rss - mem.heapTotal)
    if (opt.external) o.external = Units.megaBytes(mem.external)
    if (opt.arrayBuffers)
      o.arrayBuffers = Units.megaBytes(mem.arrayBuffers || 0)

    if (logRPS) Object.assign(o, { rps10, rpsTotal })

    logger.log(inspect(o, inspectOpt))

    if (sizes?.items.length) {
      logger.log(sizes.getStats())

      if (sizesZipped?.items.length) {
        logger.log(sizesZipped.getStats())
      }
    }

    if (tenx) {
      let perHour: number | string =
        Math.round((batchedProgress * 1000 * 60 * 60) / (now - started)) || 0
      if (perHour > 900) {
        perHour = Math.round(perHour / 1000) + 'K'
      }

      logger.log(
        `${grey(LocalTime.now().toPretty())} ${white(metric)} took ${yellow(
          Time.since(started),
        )} so far to process ${yellow(batchedProgress)} rows, ~${yellow(
          perHour,
        )}/hour`,
      )
    } else if (final) {
      logger.log(
        `${bold(metric)} took ${yellow(
          Time.since(started),
        )} to process ${yellow(
          batchedProgress,
        )} rows with total RPS of ${yellow(rpsTotal)}`,
      )
    }
  }
}
