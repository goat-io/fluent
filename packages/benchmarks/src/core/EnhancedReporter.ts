import boxen from 'boxen'
import chalk from 'chalk'
import cliProgress from 'cli-progress'
import Table from 'cli-table3'
import { BenchmarkResult, BenchmarkSuite } from '../types'
import { PerformanceChart } from '../visualization/PerformanceChart'
import { ComparisonEngine } from './ComparisonEngine'
import { QuickComparison } from './QuickComparison'

export class EnhancedBenchmarkReporter {
  private progressBar: cliProgress.SingleBar | null = null
  private chart = new PerformanceChart()
  private comparisonEngine = new ComparisonEngine()

  formatTime(ms: number): string {
    if (ms < 1) {
      return chalk.cyan(`${(ms * 1000).toFixed(2)}μs`)
    }
    if (ms < 1000) {
      return chalk.cyan(`${ms.toFixed(2)}ms`)
    }
    return chalk.cyan(`${(ms / 1000).toFixed(2)}s`)
  }

  formatMemory(bytes: number): string {
    if (bytes < 1024) {
      return chalk.magenta(`${bytes}B`)
    }
    if (bytes < 1024 * 1024) {
      return chalk.magenta(`${(bytes / 1024).toFixed(2)}KB`)
    }
    if (bytes < 1024 * 1024 * 1024) {
      return chalk.magenta(`${(bytes / 1024 / 1024).toFixed(2)}MB`)
    }
    return chalk.magenta(`${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`)
  }

  formatOpsPerSecond(ops: number): string {
    if (ops < 1000) {
      return chalk.green(`${ops.toFixed(2)} ops/s`)
    }
    if (ops < 1000000) {
      return chalk.green(`${(ops / 1000).toFixed(2)}k ops/s`)
    }
    return chalk.green(`${(ops / 1000000).toFixed(2)}M ops/s`)
  }

  formatPercentage(value: number): string {
    const color = value >= 80 ? 'green' : value >= 60 ? 'yellow' : 'red'
    return chalk[color](`${(value * 100).toFixed(1)}%`)
  }

  printComparisonHeader(title: string): void {
    console.log(
      '\n' +
        boxen(chalk.bold.blue(title), {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'blue'
        })
    )
  }

  printResult(result: BenchmarkResult): void {
    const table = new Table({
      head: [chalk.bold('Metric'), chalk.bold('Value')],
      colWidths: [25, 20],
      style: {
        head: ['cyan'],
        border: ['grey']
      }
    })

    table.push(
      ['Benchmark', chalk.bold(result.name)],
      ['Description', result.description || 'N/A'],
      ['Iterations', chalk.yellow(result.iterations.toLocaleString())],
      ['Average Time', this.formatTime(result.averageTime)],
      ['Min Time', this.formatTime(result.minTime)],
      ['Max Time', this.formatTime(result.maxTime)],
      ['Operations/sec', this.formatOpsPerSecond(result.operationsPerSecond)],
      ['Memory Usage', this.formatMemory(result.memoryUsage.heapUsed)],
      ['Timestamp', chalk.grey(result.timestamp.toISOString())]
    )

    console.log(table.toString())
  }

  compareResults(results: BenchmarkResult[]): void {
    if (results.length < 2) {
      return
    }

    const fastest = results.reduce((fastest, current) =>
      current.operationsPerSecond > fastest.operationsPerSecond
        ? current
        : fastest
    )

    const table = new Table({
      head: [
        chalk.bold('Benchmark'),
        chalk.bold('Ops/sec'),
        chalk.bold('Relative Speed'),
        chalk.bold('Avg Time'),
        chalk.bold('Memory'),
        chalk.bold('Status')
      ],
      colWidths: [25, 15, 18, 15, 12, 12],
      style: {
        head: ['cyan'],
        border: ['grey']
      }
    })

    results
      .sort((a, b) => b.operationsPerSecond - a.operationsPerSecond)
      .forEach((result, index) => {
        const relative =
          result.operationsPerSecond / fastest.operationsPerSecond
        const relativeText =
          relative === 1
            ? chalk.green.bold('🏆 100%')
            : this.formatPercentage(relative)

        const status =
          index === 0
            ? chalk.green('✓ FASTEST')
            : chalk.yellow(`${((1 - relative) * 100).toFixed(1)}% slower`)

        table.push([
          result.name,
          this.formatOpsPerSecond(result.operationsPerSecond),
          relativeText,
          this.formatTime(result.averageTime),
          this.formatMemory(result.memoryUsage.heapUsed),
          status
        ])
      })

    console.log(table.toString())
  }

  printPerformanceInsights(results: BenchmarkResult[]): void {
    if (results.length < 2) {
      return
    }

    // Sort results by performance
    const sortedResults = [...results].sort(
      (a, b) => b.operationsPerSecond - a.operationsPerSecond
    )
    const winner = sortedResults[0]
    const runnerUp = sortedResults[1]

    // Calculate advantages
    const speedAdvantage =
      (winner.operationsPerSecond / runnerUp.operationsPerSecond - 1) * 100
    const memoryAdvantage =
      (runnerUp.memoryUsage.heapUsed / winner.memoryUsage.heapUsed - 1) * 100

    // Generate grade based on performance difference
    const getGrade = (advantage: number) => {
      if (advantage > 100) {
        return 'A+'
      }
      if (advantage > 50) {
        return 'A'
      }
      if (advantage > 25) {
        return 'B'
      }
      if (advantage > 10) {
        return 'C'
      }
      return 'D'
    }

    const content = [
      chalk.bold.green('🏆 PERFORMANCE BATTLE RESULTS'),
      '',
      `🥇 Winner: ${chalk.bold.green(winner.name.split(' - ')[0])}`,
      `🥈 Runner-up: ${chalk.grey(runnerUp.name.split(' - ')[0])}`
    ]

    // Add other participants if more than 2
    if (results.length > 2) {
      content.push(
        `🥉 Third: ${chalk.grey(sortedResults[2].name.split(' - ')[0])}`
      )
      if (results.length > 3) {
        content.push(
          `🏅 Fourth: ${chalk.grey(sortedResults[3].name.split(' - ')[0])}`
        )
      }
    }

    content.push(
      '',
      `⚡ Speed Advantage: ${chalk.green.bold(`${speedAdvantage.toFixed(1)}%`)}`,
      `💾 Memory Advantage: ${chalk.blue.bold(`${memoryAdvantage.toFixed(1)}%`)}`,
      `🎯 Grade: ${this.formatGrade(getGrade(speedAdvantage))}`,
      '',
      `💡 ${chalk.italic(this.getRecommendation(winner.name.split(' - ')[0], speedAdvantage))}`
    )

    console.log(
      boxen(content.join('\n'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      })
    )
  }

  private getRecommendation(winner: string, advantage: number): string {
    if (advantage > 50) {
      return `${winner} shows significant performance advantages - recommended for high-performance scenarios`
    }
    if (advantage > 25) {
      return `${winner} demonstrates solid performance gains - a good choice for most applications`
    }
    if (advantage > 10) {
      return `${winner} has moderate advantages - consider based on other factors like developer experience`
    }
    return `Performance is very close - choose based on features and developer preference`
  }

  private formatGrade(grade: string): string {
    const color = grade.startsWith('A')
      ? 'green'
      : grade.startsWith('B')
        ? 'yellow'
        : 'red'
    return chalk.bold[color](grade)
  }

  printComprehensiveReport(results: BenchmarkResult[]): void {
    // Use the new comparison engine for a comprehensive dashboard
    this.comparisonEngine.renderComparisonDashboard(results)

    // Add visual charts
    this.chart.renderBarChart(results, 'operationsPerSecond')
    this.chart.renderComparisonMatrix(results)
    this.chart.renderMemoryChart(results)
    this.chart.renderHistogram(results)
  }

  /**
   * Shows quick, easy-to-understand comparison results
   */
  printQuickComparison(results: BenchmarkResult[]): void {
    QuickComparison.showSimpleAnswer(results)
    QuickComparison.showWinner(results)
    QuickComparison.showTrafficLight(results)
    QuickComparison.showPercentageComparison(results)
    QuickComparison.showThumbsComparison(results)
  }

  printSummaryStats(results: BenchmarkResult[]): void {
    const drivers = ['MySQL2', 'Prisma', 'Kysely', 'Drizzle']
    const scenarios = [...new Set(results.map(r => r.name.split(' - ')[1]))]

    // Calculate wins for each driver
    const winCounts = drivers.reduce(
      (acc, driver) => {
        acc[driver] = 0
        return acc
      },
      {} as Record<string, number>
    )

    scenarios.forEach(scenario => {
      const scenarioResults = drivers
        .map(driver => ({
          driver,
          result: results.find(
            r => r.name.includes(driver) && r.name.includes(scenario)
          )
        }))
        .filter(d => d.result)
        .sort(
          (a, b) =>
            b.result!.operationsPerSecond - a.result!.operationsPerSecond
        )

      if (scenarioResults.length > 0) {
        winCounts[scenarioResults[0].driver]++
      }
    })

    const activeDrivers = drivers.filter(driver =>
      results.some(r => r.name.includes(driver))
    )
    const content = [
      chalk.bold.yellow('📈 Summary Statistics'),
      '',
      ...activeDrivers.map((driver, index) => {
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'
        const color =
          index === 0
            ? 'green'
            : index === 1
              ? 'blue'
              : index === 2
                ? 'yellow'
                : 'magenta'
        return `${medal} ${driver} Wins: ${chalk[color].bold(winCounts[driver])}`
      }),
      `📊 Total Scenarios: ${chalk.yellow(scenarios.length)}`,
      `⏱️  Total Benchmark Time: ${chalk.cyan(this.formatTime(results.reduce((sum, r) => sum + r.totalTime, 0)))}`
    ]

    console.log(
      boxen(content.join('\n'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      })
    )
  }

  printRecommendations(results: BenchmarkResult[]): void {
    const drivers = [
      {
        name: 'MySQL2',
        results: results.filter(r => r.name.includes('MySQL2'))
      },
      {
        name: 'Prisma',
        results: results.filter(r => r.name.includes('Prisma'))
      },
      {
        name: 'Kysely',
        results: results.filter(r => r.name.includes('Kysely'))
      },
      {
        name: 'Drizzle',
        results: results.filter(r => r.name.includes('Drizzle'))
      }
    ]
      .filter(d => d.results.length > 0)
      .map(d => ({
        name: d.name,
        avgOps:
          d.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) /
          d.results.length
      }))
      .sort((a, b) => b.avgOps - a.avgOps)

    const recommendations = []
    const winner = drivers[0]
    const secondBest = drivers[1]

    if (winner.name === 'MySQL2') {
      recommendations.push(
        '🚀 For maximum performance, MySQL2 provides direct database access'
      )
      recommendations.push(
        '📊 MySQL2 shows consistent speed advantages for raw queries'
      )
    } else if (winner.name === 'Kysely') {
      recommendations.push(
        '⚡ Kysely offers excellent type safety with minimal performance overhead'
      )
      recommendations.push(
        '🛠️ Consider Kysely for type-safe queries without ORM complexity'
      )
    } else if (winner.name === 'Drizzle') {
      recommendations.push(
        '🔥 Drizzle provides modern TypeScript experience with great performance'
      )
      recommendations.push(
        '📈 Drizzle balances developer experience with runtime efficiency'
      )
    } else if (winner.name === 'Prisma') {
      recommendations.push(
        '✨ Prisma excels in developer experience with competitive performance'
      )
      recommendations.push(
        '🛡️ Consider Prisma for full-featured ORM with excellent tooling'
      )
    }

    if (secondBest && winner.avgOps / secondBest.avgOps < 1.2) {
      recommendations.push(
        `🤝 ${winner.name} and ${secondBest.name} show similar performance - choose based on your needs`
      )
    }

    recommendations.push(
      '🔄 For read-heavy workloads, consider raw SQL approaches (MySQL2/Kysely)'
    )
    recommendations.push(
      '✨ For complex applications, ORMs (Prisma/Drizzle) provide better abstractions'
    )
    recommendations.push(
      '📈 Consider mixing approaches: ORM for CRUD, raw queries for complex operations'
    )

    console.log(
      boxen(
        [chalk.bold.green('💡 Recommendations'), '', ...recommendations].join(
          '\n'
        ),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      )
    )
  }

  startProgressBar(total: number, title: string): void {
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.cyan(title)} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    })
    this.progressBar.start(total, 0)
  }

  updateProgress(value: number): void {
    if (this.progressBar) {
      this.progressBar.update(value)
    }
  }

  stopProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop()
      this.progressBar = null
    }
  }

  exportToJson(suite: BenchmarkSuite, filename?: string): void {
    const fileName = filename || `benchmark-${Date.now()}.json`
    const fs = require('node:fs')
    fs.writeFileSync(fileName, JSON.stringify(suite, null, 2))
    console.log(
      boxen(`📁 Results exported to ${chalk.green(fileName)}`, {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green'
      })
    )
  }

  printEnvironmentInfo(): void {
    console.log(
      boxen(
        [
          chalk.bold.blue('🖥️  Environment Information'),
          '',
          `Node.js: ${chalk.green(process.version)}`,
          `Platform: ${chalk.green(process.platform)} ${chalk.green(process.arch)}`,
          `CPU Count: ${chalk.green(require('node:os').cpus().length)}`,
          `Memory: ${this.formatMemory(require('node:os').totalmem())}`,
          `Container: ${chalk.green('Docker Testcontainers')}`
        ].join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue'
        }
      )
    )
  }
}
