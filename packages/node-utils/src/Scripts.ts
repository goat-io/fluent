import { runScript } from './scripts/runScript'
import { runCommand as runCommandScript } from './scripts/runCommand'

/**
 * Utility class providing script execution methods.
 * 
 * @example
 * ```typescript
 * import { Scripts } from '@goatlab/node-utils'
 * 
 * // Run an async script
 * Scripts.run(async () => {
 *   await doWork()
 * })
 * ```
 */
class ScriptsClass {
  /**
   * Executes an async function as a script with proper error and signal handling.
   * 
   * @see {@link runScript} for detailed documentation
   */
  run = runScript
  
  /**
   * Executes a shell command with comprehensive signal handling and cross-platform support.
   * 
   * This method provides robust command execution with proper cleanup, signal forwarding,
   * and graceful termination handling for both Windows and Unix-like systems.
   * 
   * @example
   * ```ts
   * // Basic usage
   * await Scripts.runCommand('npm install')
   * 
   * // With options
   * await Scripts.runCommand('npm test', {
   *   cwd: './my-project',
   *   silent: true
   * })
   * 
   * // Capture output
   * const version = await Scripts.runCommand('node --version', { 
   *   captureOutput: true 
   * })
   * ```
   * 
   * @see {@link runCommandScript} for detailed documentation
   */
  runCommand = runCommandScript
}

/**
 * Scripts utility instance for executing scripts and commands.
 */
export const Scripts = new ScriptsClass()

/**
 * Direct export of the runScript function for convenience.
 * 
 * @see {@link runScript} for detailed documentation
 */
export { runScript }
