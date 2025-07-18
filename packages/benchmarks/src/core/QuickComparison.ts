import { BenchmarkResult } from '../types'
import chalk from 'chalk'
import boxen from 'boxen'

export class QuickComparison {
  /**
   * Shows a super simple "this is better" comparison
   */
  static showWinner(results: BenchmarkResult[]): void {
    if (results.length < 2) return

    // Get results for all drivers
    const mysql2Results = results.filter(r => r.name.includes('MySQL2'))
    const prismaResults = results.filter(r => r.name.includes('Prisma'))
    const kyselyResults = results.filter(r => r.name.includes('Kysely'))
    const drizzleResults = results.filter(r => r.name.includes('Drizzle'))

    // Calculate average ops for each driver
    const drivers = [
      { name: 'MySQL2', results: mysql2Results },
      { name: 'Prisma', results: prismaResults },
      { name: 'Kysely', results: kyselyResults },
      { name: 'Drizzle', results: drizzleResults }
    ].filter(d => d.results.length > 0)
      .map(d => ({
        name: d.name,
        avgOps: d.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / d.results.length
      }))
      .sort((a, b) => b.avgOps - a.avgOps)

    if (drivers.length < 2) return

    const winner = drivers[0]
    const advantage = ((winner.avgOps / drivers[1].avgOps) - 1) * 100

    const icon = advantage > 50 ? '🚀' : advantage > 25 ? '⚡' : '📈'
    const color = advantage > 50 ? 'green' : advantage > 25 ? 'yellow' : 'blue'

    const content = [
      chalk.bold.white('🏆 QUICK ANSWER'),
      '',
      `${icon} ${chalk.bold[color](winner.name)} is ${chalk.bold(advantage.toFixed(0) + '%')} faster`,
      '',
      ...drivers.map(d => `${chalk.bold(d.name + ':')} ${d.avgOps.toFixed(0)} ops/sec`),
      '',
      chalk.italic(this.getQuickRecommendation(winner.name, advantage)),
    ]

    console.log('\n' + boxen(content.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: color,
      width: 50,
      textAlignment: 'center'
    }))
  }

  /**
   * Shows a traffic light style comparison
   */
  static showTrafficLight(results: BenchmarkResult[]): void {
    if (results.length < 2) return

    // Get results for all drivers
    const drivers = [
      { name: 'MySQL2', results: results.filter(r => r.name.includes('MySQL2')) },
      { name: 'Prisma', results: results.filter(r => r.name.includes('Prisma')) },
      { name: 'Kysely', results: results.filter(r => r.name.includes('Kysely')) },
      { name: 'Drizzle', results: results.filter(r => r.name.includes('Drizzle')) }
    ].filter(d => d.results.length > 0)
      .map(d => ({
        name: d.name,
        avgOps: d.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / d.results.length
      }))
      .sort((a, b) => b.avgOps - a.avgOps)

    if (drivers.length < 2) return

    const winner = drivers[0]
    const getTrafficLight = (driver: typeof drivers[0]) => {
      const relativePerformance = (driver.avgOps / winner.avgOps) * 100
      if (relativePerformance === 100) return chalk.green('🟢 EXCELLENT')
      if (relativePerformance >= 75) return chalk.yellow('🟡 GOOD')
      if (relativePerformance >= 50) return chalk.yellow('🟡 SLOWER')
      return chalk.red('🔴 SLOW')
    }

    const content = [
      chalk.bold.white('🚦 TRAFFIC LIGHT COMPARISON'),
      '',
      ...drivers.map(d => `${chalk.bold(d.name + ':')} ${getTrafficLight(d)}`),
      '',
      `Performance Gap: ${chalk.bold(((winner.avgOps / drivers[drivers.length - 1].avgOps - 1) * 100).toFixed(0) + '%')}`,
    ]

    console.log('\n' + boxen(content.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'white',
      width: 40,
      textAlignment: 'center'
    }))
  }

  /**
   * Shows a simple thumbs up/down comparison
   */
  static showThumbsComparison(results: BenchmarkResult[]): void {
    console.log('\n' + chalk.bold.cyan('👍 THUMBS UP/DOWN COMPARISON'))
    
    const scenarios = [...new Set(results.map(r => r.name.split(' - ')[1]))]
    const drivers = ['MySQL2', 'Prisma', 'Kysely', 'Drizzle']
    
    scenarios.forEach(scenario => {
      const scenarioResults = drivers
        .map(driver => ({
          driver,
          result: results.find(r => r.name.includes(driver) && r.name.includes(scenario))
        }))
        .filter(d => d.result)
        .sort((a, b) => b.result!.operationsPerSecond - a.result!.operationsPerSecond)
      
      if (scenarioResults.length >= 2) {
        const winner = scenarioResults[0]
        const output = scenarioResults.map(d => {
          const icon = d.driver === winner.driver ? chalk.green('👍') : chalk.red('👎')
          return `${d.driver} ${icon}`
        }).join(' │ ')
        
        console.log(`${scenario.padEnd(20)} │ ${output}`)
      }
    })
  }

  /**
   * Shows a percentage-based comparison
   */
  static showPercentageComparison(results: BenchmarkResult[]): void {
    const scenarios = [...new Set(results.map(r => r.name.split(' - ')[1]))]
    const drivers = ['MySQL2', 'Prisma', 'Kysely', 'Drizzle']
    
    // Count wins for each driver
    const winCounts = drivers.reduce((acc, driver) => ({ ...acc, [driver]: 0 }), {} as Record<string, number>)
    
    scenarios.forEach(scenario => {
      const scenarioResults = drivers
        .map(driver => ({
          driver,
          result: results.find(r => r.name.includes(driver) && r.name.includes(scenario))
        }))
        .filter(d => d.result)
        .sort((a, b) => b.result!.operationsPerSecond - a.result!.operationsPerSecond)
      
      if (scenarioResults.length > 0) {
        winCounts[scenarioResults[0].driver]++
      }
    })

    const totalScenarios = scenarios.length
    const driverStats = drivers
      .filter(driver => results.some(r => r.name.includes(driver)))
      .map(driver => ({
        driver,
        wins: winCounts[driver],
        percentage: (winCounts[driver] / totalScenarios) * 100
      }))
      .sort((a, b) => b.wins - a.wins)

    const topWinner = driverStats[0]
    const colors = ['green', 'blue', 'yellow', 'magenta']

    const content = [
      chalk.bold.white('📊 WIN PERCENTAGE'),
      '',
      ...driverStats.map((d, i) => 
        `${chalk.bold(d.driver + ':')} ${chalk[colors[i] || 'white'](d.percentage.toFixed(0) + '%')} (${d.wins}/${totalScenarios})`
      ),
      '',
      chalk.italic(`${topWinner.driver} wins more scenarios`),
    ]

    console.log('\n' + boxen(content.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: colors[0],
      width: 35,
      textAlignment: 'center'
    }))
  }

  /**
   * Shows the simplest possible answer
   */
  static showSimpleAnswer(results: BenchmarkResult[]): void {
    // Get results for all drivers
    const drivers = [
      { name: 'MySQL2', results: results.filter(r => r.name.includes('MySQL2')) },
      { name: 'Prisma', results: results.filter(r => r.name.includes('Prisma')) },
      { name: 'Kysely', results: results.filter(r => r.name.includes('Kysely')) },
      { name: 'Drizzle', results: results.filter(r => r.name.includes('Drizzle')) }
    ].filter(d => d.results.length > 0)
      .map(d => ({
        name: d.name,
        avgOps: d.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / d.results.length
      }))
      .sort((a, b) => b.avgOps - a.avgOps)

    if (drivers.length < 2) return

    const winner = drivers[0]
    const secondPlace = drivers[1]
    const advantage = ((winner.avgOps / secondPlace.avgOps) - 1) * 100

    console.log('\n' + boxen(
      chalk.bold.white(`${winner.name} is ${advantage.toFixed(0)}% faster`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
        textAlignment: 'center'
      }
    ))
  }

  private static getQuickRecommendation(winner: string, advantage: number): string {
    if (advantage > 50) {
      return `${winner} is significantly faster - clear choice for performance`
    } else if (advantage > 25) {
      return `${winner} shows solid performance advantages`
    } else if (advantage > 10) {
      return `${winner} has moderate advantages`
    } else {
      return `Performance is very close - choose based on other factors`
    }
  }
}