// https://github.com/winstonjs/winston
import * as winston from 'winston'

const { combine, timestamp, errors, prettyPrint } =
  winston.format

const logger = winston.createLogger({
  format: combine(errors({ stack: true }), timestamp(), prettyPrint()),
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    })
  ]
})

export const Log = (() => logger)()
