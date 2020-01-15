const log = require('loglevel')
const chalk = require('chalk')
const prefix = require('loglevel-plugin-prefix')

enum colors {
  TRACE = chalk.magenta,
  DEBUG = chalk.cyan,
  INFO = chalk.blue,
  WARN = chalk.yellow,
  ERROR = chalk.red
}

prefix.reg(log)
if (process.env.GOAT_DEBUG === 'NONE') {
  log.disableAll()
} else if (String(process.env.GOAT_DEBUG) === String('*') || !process.env.GOAT_DEBUG) {
  log.enableAll()
} else {
  log.setLevel(process.env.GOAT_DEBUG)
}
prefix.apply(log, {
  template: '[%t] %l (%n):',
  levelFormatter(level: colors) {
    return colors[level]
  },
  nameFormatter(name: any) {
    return name ? chalk.green(name) : 'global'
  },
  timestampFormatter(date: any) {
    return chalk.gray(date.toISOString())
  }
})

export const gLog = (name: string) => {
  const moduleName = name || 'global'
  return log.getLogger(moduleName)
}
