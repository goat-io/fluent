const logger = require('loglevel')
const chalk = require('chalk')
const prefix = require('loglevel-plugin-prefix')

const colors = {
  DEBUG: chalk.cyan,
  ERROR: chalk.red,
  INFO: chalk.blue,
  TRACE: chalk.magenta,
  WARN: chalk.yellow
}

prefix.reg(logger)

interface LogLevel {
  TRACE: 0
  DEBUG: 1
  INFO: 2
  WARN: 3
  ERROR: 4
  SILENT: 5
}

type LogLevelNumbers = LogLevel[keyof LogLevel]

type LogLevelDesc = LogLevelNumbers | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | keyof LogLevel

const getLevel = (): LogLevelDesc => {
  const level = process.env.APP_DEBUG || 'silent'
  let type: LogLevelDesc = 'silent'
  switch (level.toLowerCase()) {
    case 'trace':
      type = 'trace'
      break
    case 'debug':
      type = 'debug'
      break
    case 'info':
      type = 'info'
      break
    case 'warn':
      type = 'warn'
      break
    case 'error':
      type = 'error'
      break
    default:
      type = 'silent'
      break
  }
  return type
}

if (getLevel() === 'silent') {
  logger.disableAll()
} else if (getLevel() === 'trace') {
  logger.enableAll()
} else {
  logger.setLevel(getLevel())
}

prefix.apply(logger, {
  format(level, name, timestamp) {
    return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`
  }
})

prefix.apply(logger.getLogger('critical'), {
  format(level, name, timestamp) {
    return chalk.red.bold(`[${timestamp}] ${level} ${name}:`)
  }
})

prefix.apply(logger, {
  template: '[%t] %l (%n):',
  levelFormatter(level) {
    return colors[level.toUpperCase()](level.toUpperCase())
  },
  nameFormatter(name) {
    return chalk.green(`${name || 'global'}`)
  },
  timestampFormatter(date) {
    return chalk.gray(`[${date.toISOString()}]`)
  }
})

export const Log = (() => {
  /**
   * Log an emergency message to the logs.
   * @param message
   */
  const emergency = (message: string) => {
    return logger.getLogger('emergency').error(message)
  }

  /**
   * Log an alert message to the logs.
   * @param message
   */
  const alert = (message: string) => {
    return logger.getLogger('alert').error(message)
  }

  /**
   * Log a critical message to the logs.
   * @param message
   */
  const critical = (message: string) => {
    return logger.getLogger('critical').error(message)
  }

  /**
   * Log a error message to the logs.
   * @param message
   */
  const error = (message: string) => {
    return logger.getLogger('error').error(message)
  }

  /**
   * Log a warning message to the logs.
   * @param message
   */
  const warning = (message: string) => {
    return logger.getLogger('warning').warn(message)
  }

  /**
   * Log a notice message to the logs.
   * @param message
   */
  const notice = (message: string) => {
    return logger.getLogger('notice').info(message)
  }

  /**
   * Log an info message to the logs.
   * @param message
   */
  const info = (message: string) => {
    return logger.getLogger('info').info(message)
  }

  /**
   * Log a debug message to the logs.
   * @param message
   */
  const debug = (message: string) => {
    return logger.getLogger('debug').debug(message)
  }

  /**
   * Log a log message to the logs.
   * @param message
   */
  const log = (message: string) => {
    return logger.getLogger('log').debug(message)
  }

  /**
   * Get a custom logger.
   * @param name
   */
  const custom = (name?: string) => {
    return logger.getLogger(name || 'global')
  }

  return Object.freeze({
    alert,
    critical,
    custom,
    debug,
    emergency,
    error,
    info,
    log,
    notice,
    warning
  })
})()
