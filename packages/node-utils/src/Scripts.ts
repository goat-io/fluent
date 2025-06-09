import { CommonLogger } from '@goatlab/js-utils'

export interface RunScriptOptions {
  /**
   * @default false
   * Set to true to NOT call process.exit(0) after function is completed.
   * Currently it exists because of `jest --maxWorkers=1` behavior. To be investigated more..
   */
  noExit?: boolean

  /**
   * Default to `console`
   */
  logger?: CommonLogger

  /**
   * Callback to handle process exit with exit code
   */
  onExit?: (code: number) => void

  /**
   * Callback to handle errors
   */
  onError?: (error: unknown) => void
}

const { DEBUG_RUN_SCRIPT } = process.env

/**
 * Use it in your top-level scripts like this:
 *
 * runScript(async () => {
 *   await lalala()
 *   // my script goes on....
 * })
 *
 * Advantages:
 * - Works kind of like top-level await
 * - No need to add `void`
 * - No need to add `.then(() => process.exit()` (e.g to close DB connections)
 * - No need to add `.catch(err => { console.error(err); process.exit(1) })`
 *
 * This function is kept light, dependency-free, exported separately.
 *
 * Set env DEBUG_RUN_SCRIPT for extra debugging.
 */
export function runScript(
  fn: () => Promise<any>,
  opt: RunScriptOptions = {}
): void {
  const { logger = console, noExit, onExit, onError } = opt
  let exiting = false

  const cleanExit = (code: number) => {
    if (exiting) return
    exiting = true
    process.removeAllListeners()
    onExit?.(code)
    if (!noExit) process.exit(code)
  }

  process.on('uncaughtException', err => {
    logger.error('uncaughtException:', err)
    onError?.(err)
    cleanExit(1)
  })
  process.on('unhandledRejection', err => {
    logger.error('unhandledRejection:', err)
    onError?.(err)
    cleanExit(1)
  })
  ;['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>
    process.once(sig as NodeJS.Signals, () => {
      logger.log(`Received ${sig}, shutting down…`)
      cleanExit(0)
    })
  )

  Promise.resolve()
    .then(() => fn())
    .then(() => cleanExit(0))
    .catch(err => {
      logger.error('runScript error:', err)
      onError?.(err)
      cleanExit(1)
    })
}

class ScriptsClass {
  run = runScript
}

export const Scripts = new ScriptsClass()
