// https://github.com/winstonjs/winston
import winston from 'winston'
const { combine, timestamp, json } = winston.format

const logger = winston.createLogger({
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    })
  ]
})

export const Log = (() => {
  return logger
})()
