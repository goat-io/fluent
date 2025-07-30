import { CommonLogger } from '@goatlab/js-utils'

/**
 * Configuration options for the runScript function.
 */
export interface RunScriptOptions {
  /**
   * Controls whether the process should exit after the script completes.
   *
   * Set to `true` to prevent calling `process.exit()` after the function completes.
   * This is useful for:
   * - Testing environments (especially with `jest --maxWorkers=1`)
   * - When running multiple scripts sequentially
   * - When the parent process needs to continue after script completion
   *
   * @default false
   */
  noExit?: boolean

  /**
   * Logger instance to use for outputting messages.
   *
   * Must implement the CommonLogger interface with methods:
   * - `log(message: string, ...args: any[]): void`
   * - `error(message: string, ...args: any[]): void`
   *
   * @default console
   */
  logger?: CommonLogger

  /**
   * Callback function invoked when the process is about to exit.
   *
   * This is called after:
   * - Successful script completion (code 0)
   * - Script errors (code 1)
   * - Signal interruption (code 0)
   *
   * @param code - The exit code (0 for success, 1 for error)
   */
  onExit?: (code: number) => void

  /**
   * Callback function invoked when an error occurs.
   *
   * This is called for:
   * - Errors thrown in the main script function
   * - Uncaught exceptions
   * - Unhandled promise rejections
   *
   * @param error - The error that occurred (can be any type)
   */
  onError?: (error: unknown) => void
}

// const { DEBUG_RUN_SCRIPT } = process.env

/**
 * Executes an async function as a top-level script with proper error handling,
 * signal handling, and process lifecycle management.
 *
 * This utility function provides a robust wrapper for running Node.js scripts,
 * handling common boilerplate code that would otherwise be needed in every script.
 * It ensures proper cleanup, error reporting, and process termination.
 *
 * ## Key Features:
 *
 * - **Automatic error handling**: Catches and logs errors, exits with code 1
 * - **Signal handling**: Gracefully handles SIGINT, SIGTERM, and SIGHUP
 * - **Clean exit**: Ensures process.exit() is called (unless disabled)
 * - **Global error catching**: Handles uncaught exceptions and unhandled rejections
 * - **Customizable logging**: Use your own logger or default to console
 * - **Exit/error callbacks**: Hook into lifecycle events
 *
 * ## Signal Handling:
 *
 * The function listens for the following signals and performs a clean shutdown:
 * - `SIGINT`: Interrupt signal (Ctrl+C)
 * - `SIGTERM`: Termination signal (used by process managers)
 * - `SIGHUP`: Hangup signal (terminal closed)
 *
 * When a signal is received:
 * 1. Logs the signal name
 * 2. Removes all process event listeners
 * 3. Calls the onExit callback (if provided)
 * 4. Exits with code 0 (unless noExit is true)
 *
 * @param fn - Async function containing your script logic
 * @param opt - Optional configuration options
 *
 * @returns void - This function doesn't return a value
 *
 * @throws Never throws directly - all errors are caught and handled
 *
 * @example
 * ```typescript
 * // Basic usage - script with automatic error handling
 * import { runScript } from '@goatlab/node-utils'
 *
 * runScript(async () => {
 *   console.log('Starting my script...')
 *   await doSomeWork()
 *   console.log('Script completed!')
 * })
 * ```
 *
 * @example
 * ```typescript
 * // With custom logger and error handling
 * import { runScript } from '@goatlab/node-utils'
 * import { createLogger } from './my-logger'
 *
 * const logger = createLogger()
 *
 * runScript(async () => {
 *   await processData()
 * }, {
 *   logger,
 *   onError: (error) => {
 *     logger.error('Script failed:', error)
 *     // Send error to monitoring service
 *     await sendToSentry(error)
 *   },
 *   onExit: (code) => {
 *     logger.info(`Script exiting with code ${code}`)
 *     // Cleanup resources
 *     await closeConnections()
 *   }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Database script with connection cleanup
 * import { runScript } from '@goatlab/node-utils'
 * import { connectDB, disconnectDB } from './database'
 *
 * runScript(async () => {
 *   const db = await connectDB()
 *
 *   try {
 *     await db.users.migrate()
 *     await db.posts.reindex()
 *   } finally {
 *     // This cleanup will run even if script is interrupted
 *     await disconnectDB()
 *   }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Testing mode - prevent process exit
 * import { runScript } from '@goatlab/node-utils'
 *
 * runScript(async () => {
 *   await runTests()
 * }, {
 *   noExit: true, // Useful for test runners
 *   onExit: (code) => {
 *     console.log(`Tests finished with code: ${code}`)
 *   }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Long-running process with graceful shutdown
 * import { runScript } from '@goatlab/node-utils'
 *
 * let server: Server
 *
 * runScript(async () => {
 *   server = await startServer()
 *   console.log('Server started on port 3000')
 *
 *   // Keep the process running
 *   await new Promise(() => {})
 * }, {
 *   onExit: async (code) => {
 *     console.log('Shutting down server...')
 *     if (server) {
 *       await server.close()
 *     }
 *     console.log('Server stopped')
 *   }
 * })
 * ```
 */
export function runScript(
  fn: () => Promise<any>,
  opt: RunScriptOptions = {}
): void {
  const { logger = console, noExit, onExit, onError } = opt
  let exiting = false

  const cleanExit = (code: number) => {
    if (exiting) {
      return
    }
    exiting = true
    process.removeAllListeners()
    onExit?.(code)
    if (!noExit) {
      process.exit(code)
    }
  }

  const errorHandler = (type: string) => (err: unknown) => {
    logger.error(`${type}:`, err)
    onError?.(err)
    cleanExit(1)
  }

  process.on('uncaughtException', errorHandler('uncaughtException'))
  process.on('unhandledRejection', errorHandler('unhandledRejection'))

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const sig of signals) {
    process.once(sig, () => {
      logger.log(`Received ${sig}, shutting down…`)
      cleanExit(0)
    })
  }

  fn()
    .then(() => cleanExit(0))
    .catch(err => {
      logger.error('runScript error:', err)
      onError?.(err)
      cleanExit(1)
    })
}
