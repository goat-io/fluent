/**
 * Process Pool implementation for managing worker processes
 */
import { ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface ProcessPoolConfig {
  maxWorkers: number
  idleTimeoutMs: number
  command: string
  args: string[]
  maxMemoryMB?: number
  maxQueueSize?: number
  zombieCheckIntervalMs?: number
  trackStats?: boolean
}

export interface ExecuteOptions {
  timeout: number
  env?: Record<string, string>
}

interface Worker {
  process: ChildProcess
  busy: boolean
  lastUsed: number
}

export class ProcessPool extends EventEmitter {
  private config: ProcessPoolConfig
  private workers: Worker[] = []
  private queue: Array<{
    task: string
    options: ExecuteOptions
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []
  private stats = {
    totalTasks: 0,
    activeTasks: 0,
    queuedTasks: 0,
    totalWorkers: 0,
    idleWorkers: 0,
    tasksPerWorker: 0
  }
  private shutdownRequested = false
  private idleCheckInterval: NodeJS.Timeout | null = null

  constructor(config: ProcessPoolConfig) {
    super()
    this.config = config

    // Start idle check
    this.idleCheckInterval = setInterval(() => {
      this.cleanupIdleWorkers()
    }, config.idleTimeoutMs)
  }

  async execute(
    task: string,
    options: ExecuteOptions
  ): Promise<{ stdout: string; stderr: string }> {
    if (this.shutdownRequested) {
      throw new Error('Pool is shutting down')
    }

    // Check queue size
    if (
      this.config.maxQueueSize &&
      this.queue.length >= this.config.maxQueueSize
    ) {
      throw new Error('Queue is full')
    }

    this.stats.totalTasks++

    return new Promise((resolve, reject) => {
      this.queue.push({ task, options, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      return
    }

    // Find or create available worker
    let worker = this.workers.find(w => !w.busy)

    if (!worker && this.workers.length < this.config.maxWorkers) {
      worker = this.createWorker()
    }

    if (!worker) {
      // All workers busy, wait
      return
    }

    const item = this.queue.shift()
    if (!item) {
      return
    }

    worker.busy = true
    worker.lastUsed = Date.now()
    this.stats.activeTasks++
    this.stats.queuedTasks = this.queue.length

    // Execute task
    const timeout = setTimeout(() => {
      if (worker?.process) {
        worker.process.kill('SIGTERM')
      }
      item.reject(new Error('Task timeout'))
    }, item.options.timeout)

    try {
      const result = await this.runTask(worker, item.task, item.options)
      clearTimeout(timeout)
      item.resolve(result)
    } catch (error) {
      clearTimeout(timeout)
      item.reject(error)
    } finally {
      worker.busy = false
      this.stats.activeTasks--
      this.processQueue()
    }
  }

  private createWorker(): Worker {
    const childProcess = spawn(this.config.command, this.config.args, {
      env: { ...process.env }
    })

    const worker: Worker = {
      process: childProcess,
      busy: false,
      lastUsed: Date.now()
    }

    this.workers.push(worker)
    this.stats.totalWorkers = this.workers.length
    this.updateIdleStats()

    return worker
  }

  private async runTask(
    _worker: Worker,
    task: string,
    options: ExecuteOptions
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const childProcess = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...options.env },
        cwd: process.cwd()
      })

      childProcess.stdout?.on('data', data => {
        stdout += data.toString()
      })

      childProcess.stderr?.on('data', data => {
        stderr += data.toString()
      })

      childProcess.on('error', error => {
        reject(error)
      })

      childProcess.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Process exited with code ${code}`))
        }
      })

      // Send task input if needed
      if (childProcess.stdin) {
        childProcess.stdin.write(task)
        childProcess.stdin.end()
      }
    })
  }

  private cleanupIdleWorkers() {
    const now = Date.now()
    this.workers = this.workers.filter(worker => {
      if (!worker.busy && now - worker.lastUsed > this.config.idleTimeoutMs) {
        worker.process.kill()
        return false
      }
      return true
    })

    this.stats.totalWorkers = this.workers.length
    this.updateIdleStats()
  }

  private updateIdleStats() {
    this.stats.idleWorkers = this.workers.filter(w => !w.busy).length
    if (this.stats.totalTasks > 0 && this.workers.length > 0) {
      this.stats.tasksPerWorker = Math.round(
        this.stats.totalTasks / this.workers.length
      )
    }
  }

  async shutdown() {
    this.shutdownRequested = true

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
      this.idleCheckInterval = null
    }

    // Kill all workers
    for (const worker of this.workers) {
      worker.process.kill()
    }

    this.workers = []
  }

  getStatistics() {
    this.updateIdleStats()
    return { ...this.stats }
  }
}
