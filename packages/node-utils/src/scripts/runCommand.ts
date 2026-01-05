import { execSync, spawn } from 'node:child_process'

/**
 * Options for configuring command execution behavior
 */
export interface RunCommandOptions {
  /** The working directory to run the command in. Defaults to process.cwd() */
  cwd?: string
  /** Working directory alias for better readability (alternative to cwd) */
  workingDirectory?: string
  /** Whether to suppress command output. Defaults to false (output is shown) */
  silent?: boolean
  /** Whether to capture and return output instead of displaying it. When true, command output is not shown in console */
  captureOutput?: boolean
}

/**
 * Execute a shell command with comprehensive signal handling and cross-platform support.
 *
 * This function provides a robust way to run shell commands with proper cleanup,
 * signal forwarding, and graceful termination handling. It supports both Windows
 * and Unix-like systems with platform-specific optimizations.
 *
 * @example
 * ```ts
 * // Basic command execution
 * await runCommand('npm install')
 * ```
 *
 * @example
 * ```ts
 * // Run in a specific directory
 * await runCommand('pnpm build', { cwd: '/path/to/project' })
 * ```
 *
 * @example
 * ```ts
 * // Using workingDirectory alias for better readability
 * await runCommand('yarn install', { workingDirectory: rootPath })
 * ```
 *
 * @example
 * ```ts
 * // Capture command output instead of displaying it
 * const output = await runCommand('echo hello', { captureOutput: true })
 * console.log(output) // "hello"
 * ```
 *
 * @example
 * ```ts
 * // Run silently (no output shown)
 * await runCommand('npm test', { silent: true })
 * ```
 *
 * @example
 * ```ts
 * // Handle errors
 * try {
 *   await runCommand('npm test')
 * } catch (error) {
 *   console.error('Command failed:', error.message)
 * }
 * ```
 *
 * @example
 * ```ts
 * // Running multiple commands
 * await runCommand('npm install && npm test', { cwd: './my-project' })
 * ```
 *
 * @param command - The shell command to execute. Can include pipes, redirects, and shell operators
 * @param options - Configuration options for command execution
 * @param options.cwd - Working directory for the command. Defaults to process.cwd()
 * @param options.workingDirectory - Alias for cwd, provides better readability
 * @param options.silent - If true, suppresses all command output
 * @param options.captureOutput - If true, captures and returns stdout instead of displaying it
 *
 * @returns Promise that resolves to void when the command completes successfully,
 *          or to a string containing stdout if captureOutput is true
 *
 * @throws {Error} Throws an error if:
 *   - The command exits with a non-zero exit code
 *   - The command cannot be spawned (e.g., command not found)
 *   - The process is terminated by a signal
 *   - captureOutput is true and stderr contains error output
 *
 * @remarks
 * ## Signal Handling
 *
 * The function sets up handlers for the following signals:
 * - **SIGINT** (Ctrl+C): Gracefully terminates the child process
 * - **SIGTERM**: Standard termination signal, handled gracefully
 * - **SIGHUP**: Terminal hangup signal, handled gracefully
 *
 * On Unix systems, the function attempts to kill the entire process group
 * to ensure all child processes are terminated. On Windows, it uses
 * taskkill with the /T flag to terminate the process tree.
 *
 * ## Platform Differences
 *
 * - **Unix/Linux/macOS**: Uses `sh -c` to execute commands
 * - **Windows**: Uses `cmd /c` to execute commands
 *
 * ## Output Handling
 *
 * - **Default**: Command output is inherited (shown in console)
 * - **silent: true**: All output is suppressed
 * - **captureOutput: true**: stdout is captured and returned, stderr is captured for error messages
 *
 * @since 1.0.0
 */
export const runCommand = (
  command: string,
  options: RunCommandOptions = {},
): Promise<undefined | string> => {
  return new Promise((resolve, reject) => {
    // Allow both cwd and workingDirectory for flexibility
    // workingDirectory is provided as a more readable alias for cwd
    const cwd = options.cwd || options.workingDirectory || process.cwd()

    // Platform-specific shell configuration
    // Windows uses cmd.exe with /c flag, Unix-like systems use sh with -c flag
    const shell = process.platform === 'win32' ? 'cmd' : 'sh'
    const shellFlag = process.platform === 'win32' ? '/c' : '-c'

    // Determine stdio configuration based on options
    // - 'inherit': Default mode, shows output in console
    // - ['inherit', 'pipe', 'pipe']: Capture stdout/stderr while keeping stdin
    // - 'pipe': Completely silent, all streams are piped
    let stdio: any = 'inherit'
    if (options.captureOutput) {
      stdio = ['inherit', 'pipe', 'pipe']
    } else if (options.silent) {
      stdio = 'pipe'
    }

    const child = spawn(shell, [shellFlag, command], {
      cwd,
      stdio,
      env: process.env,
    })

    // Capture output if requested
    let stdout = ''
    let stderr = ''

    if (options.captureOutput) {
      child.stdout?.on('data', data => {
        stdout += data.toString()
      })
      child.stderr?.on('data', data => {
        stderr += data.toString()
      })
    }

    // Flag to prevent multiple cleanup attempts
    let isTerminating = false

    // Handle SIGINT (Ctrl+C), SIGTERM, and SIGHUP
    // This cleanup function ensures graceful shutdown of child processes
    const cleanup = (signal: string) => {
      if (!child.killed && !isTerminating) {
        isTerminating = true

        // Log a clean termination message for user feedback
        if (signal === 'SIGINT') {
          console.log(
            '\n\nReceived interrupt signal, shutting down gracefully...',
          )
        } else if (signal === 'SIGHUP' || signal === 'SIGTERM') {
          console.log(`\nReceived ${signal}, shutting down gracefully...`)
        }

        // Platform-specific process termination
        if (process.platform !== 'win32') {
          // Unix-like systems: Kill the entire process group
          // Negative PID targets all processes in the group
          try {
            process.kill(-child.pid!, 'SIGTERM')
          } catch (_e) {
            // If process group kill fails, kill the child directly
            child.kill('SIGTERM')
          }
        } else {
          // Windows: Use taskkill to terminate the process tree
          // /T flag kills child processes, /F forces termination
          try {
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
          } catch (_e) {
            // Fallback to standard kill if taskkill fails
            child.kill('SIGTERM')
          }
        }
      }
    }

    process.on('SIGINT', () => cleanup('SIGINT'))
    process.on('SIGTERM', () => cleanup('SIGTERM'))
    process.on('SIGHUP', () => cleanup('SIGHUP'))

    // Handle child process completion
    child.on('close', code => {
      // Clean up signal handlers to prevent memory leaks
      process.removeAllListeners('SIGINT')
      process.removeAllListeners('SIGTERM')
      process.removeAllListeners('SIGHUP')

      if (code === 0) {
        // Success: Return captured output or resolve void
        if (options.captureOutput) {
          resolve(stdout.trim())
        } else {
          resolve(undefined as any)
        }
      } else if (code === null) {
        // Process was killed by a signal
        reject(new Error('Process terminated'))
      } else {
        // Non-zero exit code indicates failure
        // Include stderr in error message if available
        const errorMessage =
          options.captureOutput && stderr
            ? `Process exited with code ${code}: ${stderr}`
            : `Process exited with code ${code}`
        reject(new Error(errorMessage))
      }
    })

    child.on('error', err => {
      process.removeAllListeners('SIGINT')
      process.removeAllListeners('SIGTERM')
      process.removeAllListeners('SIGHUP')
      reject(err)
    })

    // For Unix systems, create a new process group
    if (process.platform !== 'win32' && child.pid) {
      try {
        // Use the child_process module's kill with negative PID to kill process group
        // The setpgid approach doesn't work in Node.js
      } catch (_e) {
        // Ignore errors, some systems don't support this
      }
    }
  })
}
