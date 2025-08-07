/**
 * Process pool for efficient Claude Code execution
 */

import { ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

// Re-export ProcessPool implementation for tests
export { ProcessPool as ProcessPoolImpl } from './process-pool-impl.js'

export interface ProcessPoolOptions {
  maxWorkers?: number
  idleTimeoutMs?: number
  warmupCommand?: string
}

interface PooledProcess {
  process: ChildProcess
  busy: boolean
  lastUsed: number
  id: string
}

export class ProcessPool extends EventEmitter {
  private workers: Map<string, PooledProcess> = new Map()
  private queue: Array<{
    resolve: (worker: PooledProcess) => void
    reject: (error: Error) => void
  }> = []
  private options: Required<ProcessPoolOptions>

  constructor(options: ProcessPoolOptions = {}) {
    super()
    this.options = {
      maxWorkers: 4,
      idleTimeoutMs: 60000,
      warmupCommand: 'echo "ready"',
      ...options
    }

    // Start idle timeout checker
    setInterval(() => this.cleanupIdleWorkers(), 10000)
  }

  async acquire(): Promise<PooledProcess> {
    // Find available worker
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        worker.busy = true
        worker.lastUsed = Date.now()
        return worker
      }
    }

    // Create new worker if below limit
    if (this.workers.size < this.options.maxWorkers) {
      const worker = await this.createWorker()
      worker.busy = true
      return worker
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
    })
  }

  release(workerId: string) {
    const worker = this.workers.get(workerId)
    if (!worker) {
      return
    }

    worker.busy = false
    worker.lastUsed = Date.now()

    // Process queued requests
    if (this.queue.length > 0) {
      const request = this.queue.shift()
      if (request) {
        worker.busy = true
        request.resolve(worker)
      }
    }
  }

  async executeCommand(
    command: string,
    args: string[],
    options: any
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const worker = await this.acquire()

    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let settled = false

      const child = spawn(command, args, options)

      const cleanup = () => {
        if (!settled) {
          settled = true
          this.release(worker.id)
        }
      }

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', chunk => {
        stderr += chunk.toString()
      })

      child.on('close', code => {
        cleanup()
        resolve({ stdout, stderr, exitCode: code })
      })

      child.on('error', error => {
        cleanup()
        reject(error)
      })

      // Store process reference for cleanup
      worker.process = child
    })
  }

  private async createWorker(): Promise<PooledProcess> {
    const workerId = `worker-${Date.now()}-${Math.random()}`

    // Create a placeholder process
    const worker: PooledProcess = {
      process: null as any,
      busy: false,
      lastUsed: Date.now(),
      id: workerId
    }

    this.workers.set(workerId, worker)
    return worker
  }

  private cleanupIdleWorkers() {
    const now = Date.now()

    for (const [id, worker] of this.workers.entries()) {
      if (!worker.busy && now - worker.lastUsed > this.options.idleTimeoutMs) {
        // Kill idle worker
        if (worker.process && !worker.process.killed) {
          worker.process.kill('SIGTERM')
        }
        this.workers.delete(id)
        this.emit('worker-cleanup', id)
      }
    }
  }

  async shutdown() {
    // Reject all queued requests
    for (const request of this.queue) {
      request.reject(new Error('Process pool shutting down'))
    }
    this.queue = []

    // Kill all workers
    for (const worker of this.workers.values()) {
      if (worker.process && !worker.process.killed) {
        worker.process.kill('SIGTERM')
      }
    }
    this.workers.clear()
  }

  getStats() {
    const busyWorkers = Array.from(this.workers.values()).filter(
      w => w.busy
    ).length
    return {
      totalWorkers: this.workers.size,
      busyWorkers,
      idleWorkers: this.workers.size - busyWorkers,
      queuedRequests: this.queue.length
    }
  }
}

// Singleton instance for Claude Code execution
let claudeProcessPool: ProcessPool | null = null

export function getClaudeProcessPool(): ProcessPool {
  if (!claudeProcessPool) {
    claudeProcessPool = new ProcessPool({
      maxWorkers: Number.parseInt(process.env.CLAUDE_MAX_WORKERS || '3'),
      idleTimeoutMs: 30000
    })
  }
  return claudeProcessPool
}

export async function shutdownClaudePool() {
  if (claudeProcessPool) {
    await claudeProcessPool.shutdown()
    claudeProcessPool = null
  }
}
