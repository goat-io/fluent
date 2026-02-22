import boxen from 'boxen'
import chalk from 'chalk'
import { BenchmarkResult } from '../types'

export interface ComparisonResult {
  winner: string
  loser: string
  speedAdvantage: number
  memoryAdvantage: number
  overallScore: number
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D'
  recommendation: string
}

export interface ScoreCard {
  library: string
  speed: number
  memory: number
  consistency: number
  overall: number
  grade: string
}

export class ComparisonEngine {
  /**
   * Compare two benchmark results and return a clear winner
   */
  compareResults(
    result1: BenchmarkResult,
    result2: BenchmarkResult,
  ): ComparisonResult {
    const speedRatio = result1.operationsPerSecond / result2.operationsPerSecond
    const memoryRatio =
      result2.memoryUsage.heapUsed / result1.memoryUsage.heapUsed

    const winner = speedRatio > 1 ? result1.name : result2.name
    const loser = speedRatio > 1 ? result2.name : result1.name

    const speedAdvantage = Math.abs((speedRatio - 1) * 100)
    const memoryAdvantage = Math.abs((memoryRatio - 1) * 100)

    // Calculate overall score (speed weighted 70%, memory 30%)
    const overallScore = speedRatio * 0.7 + memoryRatio * 0.3

    const grade = this.calculateGrade(overallScore)
    const recommendation = this.generateRecommendation(
      speedAdvantage,
      memoryAdvantage,
      winner,
    )

    return {
      winner,
      loser,
      speedAdvantage,
      memoryAdvantage,
      overallScore,
      grade,
      recommendation,
    }
  }

  /**
   * Generate score cards for all results
   */
  generateScoreCards(results: BenchmarkResult[]): ScoreCard[] {
    const mysql2Results = results.filter(r => r.name.includes('MySQL2'))
    const prismaResults = results.filter(r => r.name.includes('Prisma'))

    const scoreCards: ScoreCard[] = []

    // Calculate MySQL2 scores
    if (mysql2Results.length > 0) {
      const mysql2Score = this.calculateLibraryScore(mysql2Results, results)
      scoreCards.push({
        library: 'MySQL2',
        ...mysql2Score,
      })
    }

    // Calculate Prisma scores
    if (prismaResults.length > 0) {
      const prismaScore = this.calculateLibraryScore(prismaResults, results)
      scoreCards.push({
        library: 'Prisma',
        ...prismaScore,
      })
    }

    return scoreCards
  }

  /**
   * Create a visual comparison dashboard
   */
  renderComparisonDashboard(results: BenchmarkResult[]): void {
    console.log(
      '\n' +
        boxen(chalk.bold.blue('🏆 PERFORMANCE COMPARISON DASHBOARD'), {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'blue',
        }),
    )

    const scoreCards = this.generateScoreCards(results)

    // Render score cards side by side
    this.renderScoreCards(scoreCards)

    // Render head-to-head comparisons
    this.renderHeadToHeadComparisons(results)

    // Render decision matrix
    this.renderDecisionMatrix(results)

    // Render final verdict
    this.renderFinalVerdict(scoreCards)
  }

  /**
   * Render score cards for each library
   */
  private renderScoreCards(scoreCards: ScoreCard[]): void {
    console.log(chalk.bold.cyan('\n📊 PERFORMANCE SCORE CARDS'))

    scoreCards.forEach(card => {
      const cardColor =
        card.overall >= 85 ? 'green' : card.overall >= 70 ? 'yellow' : 'red'

      console.log(
        boxen(
          [
            chalk.bold.white(`${card.library} Performance Report`),
            '',
            `🚀 Speed Score:       ${this.formatScore(card.speed)}`,
            `💾 Memory Score:      ${this.formatScore(card.memory)}`,
            `📈 Consistency:       ${this.formatScore(card.consistency)}`,
            '',
            `🏆 Overall Score:     ${chalk.bold[cardColor](card.overall.toFixed(1))}`,
            `🎯 Grade:             ${this.formatGrade(card.grade)}`,
          ].join('\n'),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: cardColor,
            title: card.library,
            titleAlignment: 'center',
          },
        ),
      )
    })
  }

  /**
   * Render head-to-head scenario comparisons
   */
  private renderHeadToHeadComparisons(results: BenchmarkResult[]): void {
    console.log(chalk.bold.cyan('\n⚔️  HEAD-TO-HEAD COMPARISONS'))

    const scenarios = [...new Set(results.map(r => r.name.split(' - ')[1]))]

    scenarios.forEach(scenario => {
      const mysql2Result = results.find(
        r => r.name.includes('MySQL2') && r.name.includes(scenario),
      )
      const prismaResult = results.find(
        r => r.name.includes('Prisma') && r.name.includes(scenario),
      )

      if (mysql2Result && prismaResult) {
        const comparison = this.compareResults(mysql2Result, prismaResult)
        this.renderScenarioComparison(
          scenario,
          comparison,
          mysql2Result,
          prismaResult,
        )
      }
    })
  }

  /**
   * Render individual scenario comparison
   */
  private renderScenarioComparison(
    scenario: string,
    comparison: ComparisonResult,
    _mysql2: BenchmarkResult,
    _prisma: BenchmarkResult,
  ): void {
    const winnerColor = comparison.winner.includes('MySQL2') ? 'green' : 'blue'
    const _loserColor = comparison.winner.includes('MySQL2') ? 'red' : 'red'

    console.log(
      boxen(
        [
          chalk.bold.white(`${scenario} Battle`),
          '',
          `🥇 Winner: ${chalk.bold[winnerColor](comparison.winner)}`,
          `🥈 Runner-up: ${chalk.grey(comparison.loser)}`,
          '',
          `⚡ Speed Advantage: ${chalk.green.bold(`${comparison.speedAdvantage.toFixed(1)}%`)}`,
          `💾 Memory Advantage: ${chalk.blue.bold(`${comparison.memoryAdvantage.toFixed(1)}%`)}`,
          `📊 Overall Score: ${this.formatGrade(comparison.grade)}`,
          '',
          `💡 ${chalk.italic(comparison.recommendation)}`,
        ].join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: winnerColor,
          width: 60,
        },
      ),
    )
  }

  /**
   * Render decision matrix
   */
  private renderDecisionMatrix(results: BenchmarkResult[]): void {
    console.log(chalk.bold.cyan('\n🎯 DECISION MATRIX'))

    const mysql2Results = results.filter(r => r.name.includes('MySQL2'))
    const prismaResults = results.filter(r => r.name.includes('Prisma'))

    const mysql2Wins = this.countWins(mysql2Results, prismaResults)
    const prismaWins = this.countWins(prismaResults, mysql2Results)

    const totalScenarios = Math.min(mysql2Results.length, prismaResults.length)

    console.log(
      boxen(
        [
          chalk.bold.white('🏆 BATTLE SUMMARY'),
          '',
          `${chalk.green('MySQL2 Victories:')} ${mysql2Wins}/${totalScenarios} ${this.getWinPercentage(mysql2Wins, totalScenarios)}`,
          `${chalk.blue('Prisma Victories:')} ${prismaWins}/${totalScenarios} ${this.getWinPercentage(prismaWins, totalScenarios)}`,
          '',
          this.renderProgressBar('MySQL2', mysql2Wins, totalScenarios, 'green'),
          this.renderProgressBar('Prisma', prismaWins, totalScenarios, 'blue'),
          '',
          `🎯 ${chalk.bold(mysql2Wins > prismaWins ? 'MySQL2 DOMINATES' : prismaWins > mysql2Wins ? 'PRISMA WINS' : 'TIE GAME')}`,
        ].join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor:
            mysql2Wins > prismaWins
              ? 'green'
              : prismaWins > mysql2Wins
                ? 'blue'
                : 'yellow',
          width: 50,
        },
      ),
    )
  }

  /**
   * Render final verdict and recommendations
   */
  private renderFinalVerdict(scoreCards: ScoreCard[]): void {
    console.log(chalk.bold.cyan('\n🏁 FINAL VERDICT'))

    const mysql2Card = scoreCards.find(c => c.library === 'MySQL2')
    const prismaCard = scoreCards.find(c => c.library === 'Prisma')

    if (!mysql2Card || !prismaCard) {
      return
    }

    const winner =
      mysql2Card.overall > prismaCard.overall ? mysql2Card : prismaCard
    const margin = Math.abs(mysql2Card.overall - prismaCard.overall)

    const verdict = this.generateVerdict(winner, margin)
    const recommendation = this.generateFinalRecommendation(
      mysql2Card,
      prismaCard,
    )

    console.log(
      boxen(
        [
          chalk.bold.white('🎖️  CHAMPION'),
          '',
          `🥇 ${chalk.bold.green(winner.library)} (${winner.overall.toFixed(1)}/100)`,
          `🏆 Grade: ${this.formatGrade(winner.grade)}`,
          `📈 Victory Margin: ${chalk.yellow(`${margin.toFixed(1)} points`)}`,
          '',
          `${chalk.bold.blue('🎯 RECOMMENDATION:')}`,
          chalk.italic(recommendation),
          '',
          `${chalk.bold.yellow('⚖️  VERDICT:')}`,
          chalk.italic(verdict),
        ].join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'green',
          width: 65,
        },
      ),
    )
  }

  /**
   * Calculate grade based on performance score
   */
  private calculateGrade(
    score: number,
  ): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' {
    if (score >= 1.5) {
      return 'A+'
    }
    if (score >= 1.3) {
      return 'A'
    }
    if (score >= 1.15) {
      return 'B+'
    }
    if (score >= 1.0) {
      return 'B'
    }
    if (score >= 0.85) {
      return 'C+'
    }
    if (score >= 0.7) {
      return 'C'
    }
    return 'D'
  }

  /**
   * Generate recommendation based on performance characteristics
   */
  private generateRecommendation(
    speedAdvantage: number,
    _memoryAdvantage: number,
    winner: string,
  ): string {
    if (speedAdvantage > 50) {
      return `${winner} shows exceptional speed advantage - ideal for high-throughput scenarios`
    }
    if (speedAdvantage > 25) {
      return `${winner} provides significant performance benefits for most use cases`
    }
    if (speedAdvantage > 10) {
      return `${winner} offers moderate performance gains - consider for performance-critical paths`
    }
    return `Performance is comparable - choose based on developer experience and features`
  }

  /**
   * Calculate comprehensive library score
   */
  private calculateLibraryScore(
    libraryResults: BenchmarkResult[],
    allResults: BenchmarkResult[],
  ): {
    speed: number
    memory: number
    consistency: number
    overall: number
    grade: string
  } {
    const avgOps =
      libraryResults.reduce((sum, r) => sum + r.operationsPerSecond, 0) /
      libraryResults.length
    const avgMemory =
      libraryResults.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0) /
      libraryResults.length

    // Calculate consistency (lower variance = higher consistency)
    const opsVariance = this.calculateVariance(
      libraryResults.map(r => r.operationsPerSecond),
    )
    const consistency = Math.max(0, 100 - (opsVariance / avgOps) * 100)

    // Normalize scores (0-100)
    const maxOps = Math.max(...allResults.map(r => r.operationsPerSecond))
    const minMemory = Math.min(...allResults.map(r => r.memoryUsage.heapUsed))

    const speed = (avgOps / maxOps) * 100
    const memory = (minMemory / avgMemory) * 100
    const overall = speed * 0.5 + memory * 0.3 + consistency * 0.2

    return {
      speed,
      memory,
      consistency,
      overall,
      grade: this.calculateGrade(overall / 100),
    }
  }

  /**
   * Helper methods
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    return (
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length
    )
  }

  private countWins(
    results1: BenchmarkResult[],
    results2: BenchmarkResult[],
  ): number {
    let wins = 0
    results1.forEach(r1 => {
      const scenario = r1.name.split(' - ')[1]
      const r2 = results2.find(r => r.name.includes(scenario))
      if (r2 && r1.operationsPerSecond > r2.operationsPerSecond) {
        wins++
      }
    })
    return wins
  }

  private getWinPercentage(wins: number, total: number): string {
    const percentage = (wins / total) * 100
    return chalk.yellow(`(${percentage.toFixed(0)}%)`)
  }

  private renderProgressBar(
    label: string,
    value: number,
    total: number,
    color: string,
  ): string {
    const percentage = value / total
    const barLength = 20
    const filled = Math.round(percentage * barLength)
    const empty = barLength - filled

    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    return `${label.padEnd(8)} ${chalk[color](bar)} ${chalk.white(value)}/${total}`
  }

  private formatScore(score: number): string {
    const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
    return chalk[color](`${score.toFixed(1)}/100`)
  }

  private formatGrade(grade: string): string {
    const color = grade.startsWith('A')
      ? 'green'
      : grade.startsWith('B')
        ? 'yellow'
        : 'red'
    return chalk.bold[color](grade)
  }

  private generateVerdict(winner: ScoreCard, margin: number): string {
    if (margin > 20) {
      return `${winner.library} is the clear winner with exceptional performance across all metrics`
    }
    if (margin > 10) {
      return `${winner.library} shows solid advantages and is the recommended choice`
    }
    if (margin > 5) {
      return `${winner.library} has slight advantages but both options are viable`
    }
    return `Performance is very close - choose based on team preference and ecosystem fit`
  }

  private generateFinalRecommendation(
    mysql2: ScoreCard,
    prisma: ScoreCard,
  ): string {
    const winner = mysql2.overall > prisma.overall ? mysql2 : prisma
    const loser = mysql2.overall > prisma.overall ? prisma : mysql2

    if (winner.speed > loser.speed + 15) {
      return `Choose ${winner.library} for high-performance applications where speed is critical`
    }
    if (winner.memory > loser.memory + 15) {
      return `Choose ${winner.library} for memory-constrained environments`
    }
    return `Both libraries show comparable performance - consider developer experience, type safety, and team expertise`
  }
}
