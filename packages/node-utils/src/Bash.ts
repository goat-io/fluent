import { execSync, spawnSync } from 'child_process'
import colors from 'colors'
import { exec } from 'shelljs'

const { program } = require('commander')
const inquirer = require('inquirer')
const cliProgress = require('cli-progress')
const ora = require('ora')
const figlet = require('figlet')

export interface PackageInfo {
  name: string
  version: string
  description: string
  logo: string
}

export interface IQuestions {
  type:
    | 'input'
    | 'number'
    | 'confirm'
    | 'list'
    | 'rawlist'
    | 'expand'
    | 'checkbox'
    | 'password'
    | 'editor'
  name: string
  message: string
  choices?: string[]
}

export const Bash = (() => {
  process
    .on('unhandledRejection', (reason: any, promise: any) => {
      console.error(
        colors.red(reason),
        colors.red('Unhandled promise rejection')
      )
    })
    .on('uncaughtException', (error: any) => {
      console.error(colors.red(error))
      process.exit(1)
    })

  const gradient = (text: string): Promise<any> =>
    new Promise((resolve, reject) => {
      figlet(text, (err, data) => {
        if (err) {
          console.log('Something went wrong...')
          console.dir(err)
          return reject()
        }
        // grad.vice(data)
        resolve(data)
      })
    })

  const createCli = async (packageInformation: PackageInfo) => {
    program.description(packageInformation.description)
    program.version(packageInformation.version)

    if (!process.argv.slice(2).length) {
      const styledText = await gradient(packageInformation.logo)
      console.log(styledText)
      // program.outputHelp()
    }

    return program
  }

  const parse = async () => {
    program.parse(process.argv)
  }
  /**
   *
   * @param command
   * @param options
   */
  const execute = (command: string, silent?: boolean): Promise<any> =>
    new Promise((resolve, reject) => {
      exec(
        command,
        { silent: typeof silent === 'undefined' ? true : silent, async: true },
        (code, stdout, stderr) => resolve(code)
      )
    })

  const executeSync = (command: string) => {
    const stdout = execSync(command)
    const child = spawnSync(command)
    if (child.stderr) {
      throw new Error(String(child.stderr))
    }
  }

  const question = async (questions: IQuestions[]) => {
    try {
      const answers = inquirer.prompt(questions)
      return answers
    } catch (error) {
      if (error.isTtyError) {
        console.log('We cant render in frontend')
      } else {
        console.log('Somethig went wrong')
        console.log(error)
      }
    }
  }

  const progressBar = () => {
    const b1 = new cliProgress.SingleBar({
      format: `Progress |${colors.cyan('{bar}')}| {percentage}% | {step}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      fps: 5
    })

    const start = (totalValue: number, startValue: number) =>
      b1.start(totalValue, startValue, { step: '' })

    const update = (currentValue: number, step?: string) =>
      b1.update(currentValue, { step: step || '' })

    const increment = (delta: number) => b1.increment(delta)

    const setTotal = (totalValue: number) => b1.setTotal(totalValue)

    const stop = () => b1.stop()

    const updateETA = (eta: number) => b1.updateETA(eta)

    return Object.freeze({
      start,
      update,
      increment,
      setTotal,
      stop,
      updateETA
    })
  }

  const spinner = (text: string) => {
    const sp = ora(text).start()

    const stop = () => {
      sp.stop()
    }

    const update = (message: string) => {
      sp.spinner = 'dots'
      sp.text = message
    }

    const succeed = (message?: string) => {
      sp.succeed(message)
    }

    const fail = (message?: string) => {
      sp.fail(message)
    }

    const warn = (message?: string) => {
      sp.warn(message)
    }

    const info = (message?: string) => {
      sp.info(message)
    }

    return Object.freeze({ stop, succeed, fail, warn, info, update })
  }

  return Object.freeze({
    execute,
    executeSync,
    createCli,
    parse,
    question,
    progressBar,
    spinner
  })
})()