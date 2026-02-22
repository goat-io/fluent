import { performance } from 'node:perf_hooks'
import {
  ConnectionPoolConfig,
  DataDistribution,
  ThinkTimeConfig,
  TransactionMix,
  WorkloadProfile,
} from './transaction-types'

export interface LatencyMetrics {
  min: number
  max: number
  mean: number
  median: number
  p50: number
  p90: number
  p95: number
  p99: number
  p999: number
  histogram: number[]
}

export interface TransactionMetrics {
  name: string
  count: number
  errors: number
  totalTime: number
  latency: LatencyMetrics
  throughput: number
}

export interface EnhancedBenchmarkResult {
  workloadProfile: string
  driver: string
  duration: number
  phases: {
    warmup: number
    rampup: number
    measurement: number
    cooldown: number
  }
  transactions: TransactionMetrics[]
  overall: {
    totalOperations: number
    totalErrors: number
    throughput: number
    avgResponseTime: number
    errorRate: number
  }
  connectionPool?: {
    avgWaitTime: number
    maxWaitTime: number
    timeouts: number
    avgActiveConnections: number
    maxActiveConnections: number
  }
}

export class EnhancedBenchmarkRunner {
  private connectionMetrics: any[] = []

  // Calculate delay based on think time configuration
  private calculateDelay(
    config: ThinkTimeConfig,
    type: 'keying' | 'thinking',
  ): number {
    const range = type === 'keying' ? config.keyingTime : config.thinkingTime
    const { min, max } = range

    switch (config.distribution) {
      case 'uniform':
        return Math.random() * (max - min) + min

      case 'exponential': {
        // Exponential distribution with mean = (min + max) / 2
        const mean = (min + max) / 2
        return -mean * Math.log(1 - Math.random())
      }

      case 'normal': {
        // Box-Muller transform for normal distribution
        const normalMean = (min + max) / 2
        const stdDev = (max - min) / 6 // 99.7% within range
        const u1 = Math.random()
        const u2 = Math.random()
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        return Math.max(min, Math.min(max, normalMean + z0 * stdDev))
      }

      default:
        return (min + max) / 2
    }
  }

  // Apply think time between operations
  private async applyThinkTime(config: ThinkTimeConfig): Promise<void> {
    const keyingDelay = this.calculateDelay(config, 'keying')
    await new Promise(resolve => setTimeout(resolve, keyingDelay))
  }

  // Apply thinking time after operation
  private async applyThinkingTime(config: ThinkTimeConfig): Promise<void> {
    const thinkingDelay = this.calculateDelay(config, 'thinking')
    await new Promise(resolve => setTimeout(resolve, thinkingDelay))
  }

  // Select transaction based on weights
  private selectWeightedTransaction(
    transactions: TransactionMix[],
  ): TransactionMix {
    const totalWeight = transactions.reduce((sum, t) => sum + t.weight, 0)
    let random = Math.random() * totalWeight

    for (const transaction of transactions) {
      random -= transaction.weight
      if (random <= 0) {
        return transaction
      }
    }

    return transactions[transactions.length - 1]
  }

  // Calculate percentiles from sorted array
  private calculatePercentile(
    sortedArray: number[],
    percentile: number,
  ): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  // Calculate comprehensive latency metrics
  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0,
        histogram: [],
      }
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: this.calculatePercentile(sorted, 50),
      p50: this.calculatePercentile(sorted, 50),
      p90: this.calculatePercentile(sorted, 90),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      p999: this.calculatePercentile(sorted, 99.9),
      histogram: this.createHistogram(sorted),
    }
  }

  // Create histogram buckets
  private createHistogram(sortedLatencies: number[]): number[] {
    const buckets = [
      1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000,
    ]
    const histogram: number[] = new Array(buckets.length + 1).fill(0)

    for (const latency of sortedLatencies) {
      let placed = false
      for (let i = 0; i < buckets.length; i++) {
        if (latency <= buckets[i]) {
          histogram[i]++
          placed = true
          break
        }
      }
      if (!placed) {
        histogram[buckets.length]++
      }
    }

    return histogram
  }

  // Generate data based on distribution pattern
  public generateDataId(
    totalRecords: number,
    distribution: DataDistribution,
  ): number {
    switch (distribution.type) {
      case 'uniform':
        return Math.floor(Math.random() * totalRecords) + 1

      case 'hotspot': {
        // 80% of queries hit 20% of data
        const hotspotSize = Math.floor(totalRecords * 0.2)
        if (
          Math.random() <
          (distribution.parameters.hotspotPercentage || 80) / 100
        ) {
          return Math.floor(Math.random() * hotspotSize) + 1
        }
        return Math.floor(Math.random() * totalRecords) + 1
      }

      case 'zipfian': {
        // Zipfian distribution
        const skew = distribution.parameters.skewFactor || 1.0
        let rank = 1
        let dice = Math.random()
        let mass = 0

        for (let i = 1; i <= totalRecords; i++) {
          mass += 1.0 / i ** skew
        }

        for (let i = 1; i <= totalRecords; i++) {
          dice -= 1.0 / i ** skew / mass
          if (dice <= 0) {
            rank = i
            break
          }
        }

        return rank
      }

      case 'temporal': {
        // Prefer recent data
        const hoursBack = distribution.parameters.temporalWindow || 24
        const recentRecords = Math.floor(totalRecords * (hoursBack / 720)) // Assume 30 days of data

        if (Math.random() < 0.9) {
          // 90% queries on recent data
          return totalRecords - Math.floor(Math.random() * recentRecords)
        }
        return Math.floor(Math.random() * totalRecords) + 1
      }

      default:
        return Math.floor(Math.random() * totalRecords) + 1
    }
  }

  // Non-uniform random (NURand) function from TPC-C
  public nurand(a: number, x: number, y: number): number {
    return (
      (((Math.floor(Math.random() * (y - x + 1)) + x) |
        Math.floor(Math.random() * a)) %
        (y - x + 1)) +
      x
    )
  }

  // Monitor connection pool metrics
  public monitorConnectionPool(poolStats: () => any): void {
    setInterval(() => {
      const stats = poolStats()
      this.connectionMetrics.push({
        timestamp: Date.now(),
        ...stats,
      })
    }, 100) // Sample every 100ms
  }

  // Calculate connection pool statistics
  private calculateConnectionPoolStats(): any {
    if (this.connectionMetrics.length === 0) {
      return undefined
    }

    const waitTimes = this.connectionMetrics
      .map(m => m.waitTime || 0)
      .filter(t => t > 0)

    const activeConnections = this.connectionMetrics.map(
      m => m.activeConnections || 0,
    )

    return {
      avgWaitTime: waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length || 0,
      maxWaitTime: Math.max(...waitTimes, 0),
      timeouts: this.connectionMetrics.filter(m => m.timeout).length,
      avgActiveConnections:
        activeConnections.reduce((a, b) => a + b, 0) /
          activeConnections.length || 0,
      maxActiveConnections: Math.max(...activeConnections, 0),
    }
  }

  // Fixed throughput pacing
  public async paceForThroughput(
    targetOpsPerSecond: number,
    completedOps: number,
    startTime: number,
  ): Promise<void> {
    const elapsedSeconds = (Date.now() - startTime) / 1000
    const expectedOps = targetOpsPerSecond * elapsedSeconds
    const ahead = completedOps - expectedOps

    if (ahead > 0) {
      // We're ahead of schedule, wait
      const waitTime = (ahead / targetOpsPerSecond) * 1000
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  // Main benchmark execution with phases
  public async runBenchmark(
    workload: WorkloadProfile,
    driver: string,
    executeTransaction: (name: string) => Promise<void>,
    options: {
      warmupDuration: number
      rampupDuration: number
      measurementDuration: number
      cooldownDuration: number
      virtualUsers: number
      connectionPoolConfig?: ConnectionPoolConfig
      dataDistribution?: DataDistribution
    },
  ): Promise<EnhancedBenchmarkResult> {
    const transactionMetrics = new Map<
      string,
      {
        count: number
        errors: number
        latencies: number[]
        totalTime: number
      }
    >()

    // Initialize metrics for each transaction type
    for (const tx of workload.transactions) {
      transactionMetrics.set(tx.name, {
        count: 0,
        errors: 0,
        latencies: [],
        totalTime: 0,
      })
    }

    // Phase 1: Warmup
    console.log(`  Phase 1/4: Warmup (${options.warmupDuration}ms)...`)
    const warmupEnd = Date.now() + options.warmupDuration
    while (Date.now() < warmupEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      try {
        await executeTransaction(tx.name)
      } catch (_error) {
        // Ignore errors during warmup
      }
    }

    // Phase 2: Rampup
    console.log(`  Phase 2/4: Rampup (${options.rampupDuration}ms)...`)
    let currentUsers = 1
    const rampupStart = Date.now()
    const rampupEnd = rampupStart + options.rampupDuration
    const rampupInterval = options.rampupDuration / options.virtualUsers

    const rampupTimer = setInterval(() => {
      if (currentUsers < options.virtualUsers) {
        currentUsers++
      }
    }, rampupInterval)

    while (Date.now() < rampupEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      try {
        await executeTransaction(tx.name)
      } catch (_error) {
        // Count but don't fail
      }
    }
    clearInterval(rampupTimer)

    // Phase 3: Measurement
    console.log(
      `  Phase 3/4: Measurement (${options.measurementDuration}ms)...`,
    )
    const measurementStart = Date.now()
    const measurementEnd = measurementStart + options.measurementDuration
    let totalOperations = 0

    while (Date.now() < measurementEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      const metrics = transactionMetrics.get(tx.name)!

      // Apply keying time
      await this.applyThinkTime(workload.thinkTime)

      const startTime = performance.now()
      try {
        await executeTransaction(tx.name)
        const endTime = performance.now()
        const latency = endTime - startTime

        metrics.count++
        metrics.latencies.push(latency)
        metrics.totalTime += latency
        totalOperations++

        // Apply thinking time
        await this.applyThinkingTime(workload.thinkTime)

        // Pace for target throughput if specified
        if (workload.targetThroughput) {
          await this.paceForThroughput(
            workload.targetThroughput,
            totalOperations,
            measurementStart,
          )
        }
      } catch (_error) {
        metrics.errors++
      }
    }

    // Phase 4: Cooldown
    console.log(`  Phase 4/4: Cooldown (${options.cooldownDuration}ms)...`)
    const cooldownEnd = Date.now() + options.cooldownDuration
    while (Date.now() < cooldownEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      try {
        await executeTransaction(tx.name)
      } catch (_error) {
        // Ignore errors during cooldown
      }
    }

    // Calculate final metrics
    const transactions: TransactionMetrics[] = []
    let totalErrors = 0
    let totalTime = 0

    for (const [name, metrics] of transactionMetrics) {
      if (metrics.count > 0) {
        transactions.push({
          name,
          count: metrics.count,
          errors: metrics.errors,
          totalTime: metrics.totalTime,
          latency: this.calculateLatencyMetrics(metrics.latencies),
          throughput: metrics.count / (options.measurementDuration / 1000),
        })
        totalErrors += metrics.errors
        totalTime += metrics.totalTime
      }
    }

    const actualMeasurementDuration = measurementEnd - measurementStart
    const overallThroughput =
      totalOperations / (actualMeasurementDuration / 1000)
    const avgResponseTime = totalTime / totalOperations

    return {
      workloadProfile: workload.name,
      driver,
      duration: actualMeasurementDuration,
      phases: {
        warmup: options.warmupDuration,
        rampup: options.rampupDuration,
        measurement: options.measurementDuration,
        cooldown: options.cooldownDuration,
      },
      transactions,
      overall: {
        totalOperations,
        totalErrors,
        throughput: overallThroughput,
        avgResponseTime,
        errorRate: (totalErrors / totalOperations) * 100,
      },
      connectionPool: this.calculateConnectionPoolStats(),
    }
  }
}
