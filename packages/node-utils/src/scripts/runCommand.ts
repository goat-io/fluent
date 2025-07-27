import { spawn, execSync } from 'child_process'

export interface RunCommandOptions {
  /** The working directory to run the command in. Defaults to process.cwd() */
  cwd?: string
  /** Working directory alias for better readability */
  workingDirectory?: string
  /** Whether to show command output. Defaults to true */
  silent?: boolean
  /** Whether to capture and return output instead of displaying it */
  captureOutput?: boolean
}

/**
 * Run a command with proper signal handling for graceful termination
 *
 * @example
 * ```ts
 * // Run in a specific directory
 * await runCommand('pnpm build', { cwd: '/path/to/project' })
 *
 * // Run in current directory
 * await runCommand('npm test')
 *
 * // Using workingDirectory alias
 * await runCommand('yarn install', { workingDirectory: rootPath })
 *
 * // Capture output
 * const output = await runCommand('echo hello', { captureOutput: true })
 * ```
 *
 * @param command The command to run
 * @param options Options for running the command
 * @returns Promise that resolves when command completes successfully, or with output if captureOutput is true
 */
export const runCommand = (
  command: string,
  options: RunCommandOptions = {}
): Promise<void | string> => {
  return new Promise((resolve, reject) => {
    // Allow both cwd and workingDirectory for flexibility
    const cwd = options.cwd || options.workingDirectory || process.cwd()

    const shell = process.platform === 'win32' ? 'cmd' : 'sh'
    const shellFlag = process.platform === 'win32' ? '/c' : '-c'

    // Determine stdio based on options
    let stdio: any = 'inherit'
    if (options.captureOutput) {
      stdio = ['inherit', 'pipe', 'pipe']
    } else if (options.silent) {
      stdio = 'pipe'
    }

    const child = spawn(shell, [shellFlag, command], {
      cwd,
      stdio,
      env: process.env
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

    let isTerminating = false

    // Handle SIGINT (Ctrl+C) and SIGTERM
    const cleanup = (signal: string) => {
      if (!child.killed && !isTerminating) {
        isTerminating = true

        // Log a clean termination message
        if (signal === 'SIGINT') {
          console.log(
            '\n\nReceived interrupt signal, shutting down gracefully...'
          )
        }

        // Send SIGTERM to the child process group
        if (process.platform !== 'win32') {
          try {
            process.kill(-child.pid!, 'SIGTERM')
          } catch (e) {
            // If process group kill fails, kill the child directly
            child.kill('SIGTERM')
          }
        } else {
          // On Windows, use taskkill to kill the process tree
          try {
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
          } catch (e) {
            child.kill('SIGTERM')
          }
        }
      }
    }

    process.on('SIGINT', () => cleanup('SIGINT'))
    process.on('SIGTERM', () => cleanup('SIGTERM'))

    child.on('close', code => {
      process.removeAllListeners('SIGINT')
      process.removeAllListeners('SIGTERM')

      if (code === 0) {
        if (options.captureOutput) {
          resolve(stdout.trim())
        } else {
          resolve()
        }
      } else if (code === null) {
        // Process was killed
        reject(new Error('Process terminated'))
      } else {
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
      reject(err)
    })

    // For Unix systems, create a new process group
    if (process.platform !== 'win32' && child.pid) {
      try {
        // Use the child_process module's kill with negative PID to kill process group
        // The setpgid approach doesn't work in Node.js
      } catch (e) {
        // Ignore errors, some systems don't support this
      }
    }
  })
}
