// npx vitest run src/__tests__/unit/container-manager.spec.ts
import type Dockerode from 'dockerode'
import type { ExecOptions, ExecResult } from '../types/SandboxConfig.js'
import { collectStream } from '../utils/StreamCollector.js'

/**
 * Handle to a running Docker container. Provides a clean interface
 * for executing commands, copying files, and managing lifecycle.
 */
export class ContainerHandle {
  readonly id: string
  private container: Dockerode.Container
  private workdir: string

  constructor(container: Dockerode.Container, workdir: string) {
    this.id = container.id
    this.container = container
    this.workdir = workdir
  }

  /**
   * Execute a shell command inside the container.
   */
  async exec(command: string, opts?: ExecOptions): Promise<ExecResult> {
    const cwd = opts?.cwd ?? this.workdir
    const shell = '/bin/sh'
    const envArray = opts?.env
      ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`)
      : []

    const wrappedCmd = `cd ${cwd} && ${command}`

    const exec = await this.container.exec({
      Cmd: [shell, '-c', wrappedCmd],
      AttachStdout: true,
      AttachStderr: true,
      Env: envArray.length > 0 ? envArray : undefined,
    })

    const stream = await exec.start({ Detach: false, Tty: false })

    let timedOut = false
    const timeout = opts?.timeout ?? 60_000
    const timeoutHandle = setTimeout(() => {
      timedOut = true
      stream.destroy()
    }, timeout)

    try {
      const { stdout, stderr } = await collectStream(stream, {
        onStdout: opts?.onStdout,
        onStderr: opts?.onStderr,
      })

      const inspect = await exec.inspect()
      const exitCode = inspect.ExitCode ?? -1

      return {
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
      }
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  /**
   * Copy a file out of the container.
   * Returns the file content as a Buffer.
   */
  async copyFileOut(containerPath: string): Promise<Buffer> {
    const stream = await this.container.getArchive({ path: containerPath })
    const chunks: Buffer[] = []

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => {
        // Docker returns a tar archive — extract the first file
        const tar = Buffer.concat(chunks)
        // Skip tar header (512 bytes) to get content
        // For single files, content starts at byte 512
        const headerSize = 512
        if (tar.length <= headerSize) {
          resolve(Buffer.alloc(0))
          return
        }
        // Read file size from tar header (bytes 124-135, octal)
        const sizeStr = tar.subarray(124, 136).toString('utf-8').trim()
        const fileSize = Number.parseInt(sizeStr, 8)
        if (Number.isNaN(fileSize) || fileSize <= 0) {
          resolve(Buffer.alloc(0))
          return
        }
        resolve(tar.subarray(headerSize, headerSize + fileSize))
      })
      stream.on('error', reject)
    })
  }

  /**
   * Write content to a file inside the container using exec.
   */
  async writeFile(containerPath: string, content: string): Promise<void> {
    // Use heredoc to avoid escaping issues
    const _escapedContent = content.replace(/'/g, "'\\''")
    const result = await this.exec(
      `cat > ${containerPath} << 'GOAT_EOF'\n${content}\nGOAT_EOF`,
      { cwd: '/' },
    )
    if (result.exitCode !== 0) {
      throw new Error(`Failed to write ${containerPath}: ${result.stderr}`)
    }
  }

  /**
   * Read a file from inside the container.
   */
  async readFile(containerPath: string): Promise<string> {
    const result = await this.exec(`cat ${containerPath}`, { cwd: '/' })
    if (result.exitCode !== 0) {
      throw new Error(`Failed to read ${containerPath}: ${result.stderr}`)
    }
    return result.stdout
  }

  /**
   * Get an environment variable value from inside the container.
   */
  async getEnv(varName: string): Promise<string | undefined> {
    const result = await this.exec(`echo "$${varName}"`, { cwd: '/' })
    if (result.exitCode !== 0) {
      return undefined
    }
    const value = result.stdout.trim()
    return value || undefined
  }

  /**
   * Stop the container gracefully.
   */
  async stop(timeoutSeconds = 10): Promise<void> {
    try {
      await this.container.stop({ t: timeoutSeconds })
    } catch (err: any) {
      // Ignore "container already stopped" errors
      if (
        !err.message?.includes('already stopped') &&
        !err.message?.includes('is not running')
      ) {
        throw err
      }
    }
  }

  /**
   * Remove the container.
   */
  async remove(): Promise<void> {
    try {
      await this.container.remove({ force: true })
    } catch (err: any) {
      // Ignore "no such container" errors
      if (
        !err.message?.includes('no such container') &&
        err.statusCode !== 404
      ) {
        throw err
      }
    }
  }

  /**
   * Stop and remove the container (cleanup).
   */
  async destroy(): Promise<void> {
    await this.stop()
    await this.remove()
  }
}
