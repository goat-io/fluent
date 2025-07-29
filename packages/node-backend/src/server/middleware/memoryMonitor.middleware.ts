// npx vitest run ./src/server/middleware/memoryMonitor.middleware.test.ts

import type { Request, Response, NextFunction } from 'express'
import { CommonLogger } from '@goatlab/js-utils'
import { yellow, red } from 'kleur/colors'

interface MemoryMonitorOptions {
  logger?: CommonLogger
  warningThreshold?: number // percentage (0-100)
  criticalThreshold?: number // percentage (0-100)
  monitorInterval?: number // milliseconds
  enableGarbageCollection?: boolean
  addHeaders?: boolean
}

interface MemoryMetrics {
  heapUsedMB: number
  heapTotalMB: number
  heapUsedPercentage: number
  rssMB: number
  timestamp: number
}

class MemoryMonitor {
  private logger: CommonLogger
  private warningThreshold: number
  private criticalThreshold: number
  private monitorInterval: number
  private enableGarbageCollection: boolean
  private addHeaders: boolean
  private intervalTimer?: NodeJS.Timeout
  private lastMetrics?: MemoryMetrics
  private gcAvailable: boolean

  constructor(options: MemoryMonitorOptions = {}) {
    this.logger = options.logger || console
    this.warningThreshold = options.warningThreshold || 90
    this.criticalThreshold = options.criticalThreshold || 95
    this.monitorInterval = options.monitorInterval || 30000 // 30 seconds default
    this.enableGarbageCollection = options.enableGarbageCollection !== false
    this.addHeaders = options.addHeaders !== false
    
    // Check if garbage collection is available
    this.gcAvailable = typeof global.gc === 'function'
    
    if (this.enableGarbageCollection && !this.gcAvailable) {
      this.logger.warn('Garbage collection is not available. Run node with --expose-gc flag to enable.')
    }
  }

  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024)
    const heapTotalMB = memUsage.heapTotal / (1024 * 1024)
    const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100
    const rssMB = memUsage.rss / (1024 * 1024)

    return {
      heapUsedMB,
      heapTotalMB,
      heapUsedPercentage,
      rssMB,
      timestamp: Date.now()
    }
  }

  private formatMemoryMetrics(metrics: MemoryMetrics): string {
    return `Heap: ${metrics.heapUsedMB.toFixed(2)}/${metrics.heapTotalMB.toFixed(2)}MB (${metrics.heapUsedPercentage.toFixed(1)}%) | RSS: ${metrics.rssMB.toFixed(2)}MB`
  }

  private checkMemoryUsage(metrics: MemoryMetrics): void {
    const { heapUsedPercentage } = metrics
    
    if (heapUsedPercentage >= this.criticalThreshold) {
      this.logger.error(
        red(`CRITICAL: Memory usage at ${heapUsedPercentage.toFixed(1)}% - ${this.formatMemoryMetrics(metrics)}`)
      )
      
      // Attempt garbage collection if available and enabled
      if (this.enableGarbageCollection && this.gcAvailable) {
        this.logger.warn('Triggering garbage collection due to critical memory usage')
        global.gc!()
        
        // Log memory after GC
        setTimeout(() => {
          const afterGcMetrics = this.getMemoryMetrics()
          this.logger.log(
            `Memory after GC: ${this.formatMemoryMetrics(afterGcMetrics)}`
          )
        }, 100)
      }
    } else if (heapUsedPercentage >= this.warningThreshold) {
      this.logger.warn(
        yellow(`WARNING: Memory usage at ${heapUsedPercentage.toFixed(1)}% - ${this.formatMemoryMetrics(metrics)}`)
      )
    }
  }

  public startMonitoring(): void {
    if (this.intervalTimer) {
      return // Already monitoring
    }

    // Initial check
    const initialMetrics = this.getMemoryMetrics()
    this.logger.log(`Memory monitoring started - ${this.formatMemoryMetrics(initialMetrics)}`)
    
    this.intervalTimer = setInterval(() => {
      const metrics = this.getMemoryMetrics()
      this.lastMetrics = metrics
      this.checkMemoryUsage(metrics)
    }, this.monitorInterval)

    // Ensure timer doesn't prevent process from exiting
    this.intervalTimer.unref()
  }

  public stopMonitoring(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = undefined
      this.logger.log('Memory monitoring stopped')
    }
  }

  public middleware() {
    return (_req: Request, res: Response, next: NextFunction) => {
      const metrics = this.getMemoryMetrics()
      this.lastMetrics = metrics

      // Add memory metrics to response headers if enabled
      if (this.addHeaders) {
        res.setHeader('X-Memory-Heap-Used-MB', metrics.heapUsedMB.toFixed(2))
        res.setHeader('X-Memory-Heap-Total-MB', metrics.heapTotalMB.toFixed(2))
        res.setHeader('X-Memory-Heap-Used-Percent', metrics.heapUsedPercentage.toFixed(1))
        res.setHeader('X-Memory-RSS-MB', metrics.rssMB.toFixed(2))
      }

      // Check memory usage on each request
      this.checkMemoryUsage(metrics)

      next()
    }
  }

  public getLastMetrics(): MemoryMetrics | undefined {
    return this.lastMetrics
  }
}

// Track if we've already added process listeners
let processListenersAdded = false

// Factory function to create memory monitor middleware
export function createMemoryMonitorMiddleware(options?: MemoryMonitorOptions): {
  middleware: (req: Request, res: Response, next: NextFunction) => void
  monitor: MemoryMonitor
} {
  const monitor = new MemoryMonitor(options)
  
  // Start background monitoring
  monitor.startMonitoring()
  
  // Handle graceful shutdown - only add listeners once globally
  if (!processListenersAdded && process.env.NODE_ENV !== 'test') {
    processListenersAdded = true
    
    const cleanup = () => {
      monitor.stopMonitoring()
    }
    
    process.once('SIGTERM', cleanup)
    process.once('SIGINT', cleanup)
  }
  
  return {
    middleware: monitor.middleware(),
    monitor
  }
}

// Convenience middleware function for simple usage
export function memoryMonitorMiddleware(options?: MemoryMonitorOptions) {
  const { middleware } = createMemoryMonitorMiddleware(options)
  return middleware
}