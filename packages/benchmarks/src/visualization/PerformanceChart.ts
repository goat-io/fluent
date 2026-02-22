import chalk from 'chalk'
import { BenchmarkResult } from '../types'

export class PerformanceChart {
  private readonly BAR_WIDTH = 40
  private readonly CHART_HEIGHT = 20

  /**
   * Creates a simple ASCII bar chart comparing performance metrics
   */
  renderBarChart(
    results: BenchmarkResult[],
    metric: 'operationsPerSecond' | 'averageTime' | 'memoryUsage',
  ): void {
    if (results.length === 0) {
      return
    }

    const values = results.map(r => {
      switch (metric) {
        case 'operationsPerSecond':
          return r.operationsPerSecond
        case 'averageTime':
          return r.averageTime
        case 'memoryUsage':
          return r.memoryUsage.heapUsed / 1024 / 1024 // Convert to MB
        default:
          return 0
      }
    })

    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const range = maxValue - minValue

    console.log(
      chalk.bold.cyan(`\n📊 ${this.getMetricTitle(metric)} Comparison`),
    )
    console.log(chalk.grey('─'.repeat(80)))

    results.forEach((result, index) => {
      const value = values[index]
      const normalizedValue = range > 0 ? (value - minValue) / range : 0.5
      const barLength = Math.round(normalizedValue * this.BAR_WIDTH)

      const bar = '█'.repeat(barLength) + '░'.repeat(this.BAR_WIDTH - barLength)
      const coloredBar = this.colorizeBar(bar, normalizedValue)

      const label = result.name.padEnd(25)
      const valueStr = this.formatValue(value, metric).padStart(12)

      console.log(
        `${chalk.bold(label)} ${coloredBar} ${chalk.yellow(valueStr)}`,
      )
    })

    console.log(chalk.grey('─'.repeat(80)))
  }

  /**
   * Creates a trend line chart showing performance over iterations
   */
  renderTrendChart(results: BenchmarkResult[]): void {
    if (results.length < 2) {
      return
    }

    console.log(chalk.bold.cyan('\n📈 Performance Trend'))
    console.log(chalk.grey('─'.repeat(80)))

    const values = results.map(r => r.operationsPerSecond)
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const range = maxValue - minValue

    // Create a simple line chart
    const chartLines: string[] = []

    for (let row = this.CHART_HEIGHT; row >= 0; row--) {
      const threshold = minValue + (range * row) / this.CHART_HEIGHT
      let line = ''

      for (let col = 0; col < values.length; col++) {
        const value = values[col]
        const char = value >= threshold ? '●' : ' '
        line += char.padEnd(8)
      }

      const yLabel = this.formatValue(
        threshold,
        'operationsPerSecond',
      ).padStart(8)
      chartLines.push(`${chalk.grey(yLabel)} │ ${line}`)
    }

    chartLines.forEach(line => console.log(line))

    // X-axis labels
    const xAxis = `${' '.repeat(10)}└${'─'.repeat(8 * values.length)}`
    console.log(chalk.grey(xAxis))

    let xLabels = ' '.repeat(12)
    results.forEach((result, _index) => {
      const shortName = result.name.split(' - ')[0].substring(0, 6)
      xLabels += shortName.padEnd(8)
    })
    console.log(chalk.grey(xLabels))

    console.log(chalk.grey('─'.repeat(80)))
  }

  /**
   * Creates a distribution histogram
   */
  renderHistogram(results: BenchmarkResult[]): void {
    if (results.length === 0) {
      return
    }

    console.log(chalk.bold.cyan('\n📊 Response Time Distribution'))
    console.log(chalk.grey('─'.repeat(80)))

    const allTimes = results.flatMap(r => [r.minTime, r.averageTime, r.maxTime])
    const minTime = Math.min(...allTimes)
    const maxTime = Math.max(...allTimes)
    const bucketSize = (maxTime - minTime) / 10

    const buckets = new Array(10).fill(0)
    const bucketLabels: string[] = []

    // Create bucket labels
    for (let i = 0; i < 10; i++) {
      const bucketStart = minTime + i * bucketSize
      const bucketEnd = minTime + (i + 1) * bucketSize
      bucketLabels.push(`${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}ms`)
    }

    // Fill buckets
    results.forEach(result => {
      const times = [result.minTime, result.averageTime, result.maxTime]
      times.forEach(time => {
        const bucketIndex = Math.min(
          Math.floor((time - minTime) / bucketSize),
          9,
        )
        buckets[bucketIndex]++
      })
    })

    const maxBucketValue = Math.max(...buckets)

    buckets.forEach((count, index) => {
      const normalizedValue = maxBucketValue > 0 ? count / maxBucketValue : 0
      const barLength = Math.round(normalizedValue * 30)
      const bar = '█'.repeat(barLength)
      const coloredBar = this.colorizeBar(bar, normalizedValue)

      console.log(
        `${bucketLabels[index].padEnd(20)} ${coloredBar} ${chalk.yellow(count.toString())}`,
      )
    })

    console.log(chalk.grey('─'.repeat(80)))
  }

  /**
   * Creates a performance comparison matrix
   */
  renderComparisonMatrix(results: BenchmarkResult[]): void {
    if (results.length < 2) {
      return
    }

    console.log(chalk.bold.cyan('\n🔄 Performance Comparison Matrix'))
    console.log(chalk.grey('─'.repeat(80)))

    const mysql2Results = results.filter(r => r.name.includes('MySQL2'))
    const prismaResults = results.filter(r => r.name.includes('Prisma'))

    if (mysql2Results.length === 0 || prismaResults.length === 0) {
      return
    }

    // Create comparison matrix
    const scenarios = [...new Set(results.map(r => r.name.split(' - ')[1]))]

    console.log(
      `${'Scenario'.padEnd(20)} │ ${'MySQL2'.padEnd(12)} │ ${'Prisma'.padEnd(12)} │ ${'Winner'.padEnd(10)} │ Advantage`,
    )
    console.log('─'.repeat(80))

    scenarios.forEach(scenario => {
      const mysql2Result = mysql2Results.find(r => r.name.includes(scenario))
      const prismaResult = prismaResults.find(r => r.name.includes(scenario))

      if (mysql2Result && prismaResult) {
        const mysql2Ops = mysql2Result.operationsPerSecond
        const prismaOps = prismaResult.operationsPerSecond

        const winner = mysql2Ops > prismaOps ? 'MySQL2' : 'Prisma'
        const advantage = Math.abs((mysql2Ops / prismaOps - 1) * 100)

        const mysql2Color = mysql2Ops > prismaOps ? chalk.green : chalk.red
        const prismaColor = prismaOps > mysql2Ops ? chalk.green : chalk.red

        console.log(
          `${scenario.padEnd(20)} │ ${mysql2Color(mysql2Ops.toFixed(0).padEnd(12))} │ ${prismaColor(prismaOps.toFixed(0).padEnd(12))} │ ${winner === 'MySQL2' ? chalk.green('MySQL2') : chalk.blue('Prisma')} │ ${chalk.yellow(`${advantage.toFixed(1)}%`)}`,
        )
      }
    })

    console.log(chalk.grey('─'.repeat(80)))
  }

  /**
   * Creates a memory usage visualization
   */
  renderMemoryChart(results: BenchmarkResult[]): void {
    if (results.length === 0) {
      return
    }

    console.log(chalk.bold.cyan('\n💾 Memory Usage Comparison'))
    console.log(chalk.grey('─'.repeat(80)))

    const maxMemory = Math.max(...results.map(r => r.memoryUsage.heapUsed))

    results.forEach(result => {
      const memoryMB = result.memoryUsage.heapUsed / 1024 / 1024
      const normalizedValue = result.memoryUsage.heapUsed / maxMemory
      const barLength = Math.max(0, Math.round(normalizedValue * 40))

      const bar =
        '█'.repeat(barLength) + '░'.repeat(Math.max(0, 40 - barLength))
      const coloredBar = this.colorizeMemoryBar(bar, normalizedValue)

      console.log(
        `${result.name.padEnd(25)} ${coloredBar} ${chalk.magenta(`${memoryMB.toFixed(2)} MB`)}`,
      )
    })

    console.log(chalk.grey('─'.repeat(80)))
  }

  private colorizeBar(bar: string, normalizedValue: number): string {
    if (normalizedValue > 0.8) {
      return chalk.green(bar)
    }
    if (normalizedValue > 0.6) {
      return chalk.yellow(bar)
    }
    if (normalizedValue > 0.4) {
      return chalk.red(bar)
    }
    return chalk.grey(bar)
  }

  private colorizeMemoryBar(bar: string, normalizedValue: number): string {
    if (normalizedValue > 0.8) {
      return chalk.red(bar) // High memory usage
    }
    if (normalizedValue > 0.6) {
      return chalk.yellow(bar) // Medium memory usage
    }
    return chalk.green(bar) // Low memory usage
  }

  private getMetricTitle(metric: string): string {
    switch (metric) {
      case 'operationsPerSecond':
        return 'Operations Per Second'
      case 'averageTime':
        return 'Average Response Time'
      case 'memoryUsage':
        return 'Memory Usage'
      default:
        return 'Performance Metric'
    }
  }

  private formatValue(value: number, metric: string): string {
    switch (metric) {
      case 'operationsPerSecond':
        return `${value.toFixed(0)} ops/s`
      case 'averageTime':
        return `${value.toFixed(2)} ms`
      case 'memoryUsage':
        return `${value.toFixed(2)} MB`
      default:
        return value.toFixed(2)
    }
  }
}
