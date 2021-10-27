// https://github.com/winstonjs/winston
import winston from 'winston'
const { combine, timestamp, json, errors, prettyPrint, colorize } =
  winston.format

const logger = winston.createLogger({
  format: combine(errors({ stack: true }), timestamp(), prettyPrint()),
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    })
  ]
})

export const Log = (() => {
  return logger
})()
