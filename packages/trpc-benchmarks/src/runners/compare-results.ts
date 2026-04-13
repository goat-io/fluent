#!/usr/bin/env tsx
// Run: npx tsx src/runners/compare-results.ts
// Options: npx tsx src/runners/compare-results.ts --dir results

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

interface BenchmarkResult {
  config: {
    name: string
    runtime: 'node' | 'bun'
    framework: 'express' | 'hono'
    port: number
  }
  metrics: {
    httpReqDuration: { avg: number; min: number; max: number; p95: number; p99: number }
    httpReqs: number
    httpReqFailed: number
    iterations: number
    vus: number
  }
  timestamp: string
}

function parseArgs(): { dir: string } {
  const args = process.argv.slice(2)
  let dir = 'results'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      dir = args[i + 1]
      i++
    }
  }

  return { dir }
}

async function loadResults(resultsDir: string): Promise<BenchmarkResult[][]> {
  const files = await readdir(resultsDir)
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse()

  const allResults: BenchmarkResult[][] = []

  for (const file of jsonFiles) {
    try {
      const content = await readFile(path.join(resultsDir, file), 'utf-8')
      const results = JSON.parse(content) as BenchmarkResult[]
      allResults.push(results)
    } catch (error) {
      console.error(`Error loading ${file}:`, error)
    }
  }

  return allResults
}

function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`
  }
  return `${ms.toFixed(2)}ms`
}

function colorLatency(ms: number, threshold: number = 10): string {
  if (ms < threshold) {
    return chalk.green(formatLatency(ms))
  } else if (ms < threshold * 2) {
    return chalk.yellow(formatLatency(ms))
  }
  return chalk.red(formatLatency(ms))
}

function printComparison(results: BenchmarkResult[]) {
  console.log(chalk.bold('\n' + '='.repeat(80)))
  console.log(chalk.bold('Benchmark Results Comparison'))
  console.log(chalk.bold('='.repeat(80)))
  console.log('')

  // Header
  console.log(
    chalk.bold('Server'.padEnd(25)) +
    chalk.bold('Avg'.padStart(12)) +
    chalk.bold('P95'.padStart(12)) +
    chalk.bold('P99'.padStart(12)) +
    chalk.bold('Min'.padStart(12)) +
    chalk.bold('Max'.padStart(12))
  )
  console.log('-'.repeat(85))

  // Results
  for (const result of results) {
    const d = result.metrics.httpReqDuration
    console.log(
      result.config.name.padEnd(25) +
      colorLatency(d.avg).padStart(12) +
      colorLatency(d.p95).padStart(12) +
      colorLatency(d.p99).padStart(12) +
      colorLatency(d.min).padStart(12) +
      colorLatency(d.max, 100).padStart(12)
    )
  }

  console.log('')

  // Comparison
  if (results.length >= 2) {
    console.log(chalk.bold('-'.repeat(80)))
    console.log(chalk.bold('Performance Comparison'))
    console.log(chalk.bold('-'.repeat(80)))
    console.log('')

    // Find best performers
    const sortedByAvg = [...results].sort((a, b) =>
      a.metrics.httpReqDuration.avg - b.metrics.httpReqDuration.avg
    )
    const sortedByP95 = [...results].sort((a, b) =>
      a.metrics.httpReqDuration.p95 - b.metrics.httpReqDuration.p95
    )
    const sortedByReqs = [...results].sort((a, b) =>
      b.metrics.httpReqs - a.metrics.httpReqs
    )

    const fastest = sortedByAvg[0]
    const slowest = sortedByAvg[sortedByAvg.length - 1]

    const speedup = ((slowest.metrics.httpReqDuration.avg - fastest.metrics.httpReqDuration.avg) /
      slowest.metrics.httpReqDuration.avg * 100)

    console.log(chalk.green(`✓ Fastest (avg latency): ${fastest.config.name}`))
    console.log(chalk.green(`✓ Best P95 latency: ${sortedByP95[0].config.name}`))
    console.log(chalk.green(`✓ Highest throughput: ${sortedByReqs[0].config.name}`))
    console.log('')

    if (speedup > 0) {
      console.log(
        chalk.cyan(`${fastest.config.name} is `) +
        chalk.bold.cyan(`${speedup.toFixed(1)}%`) +
        chalk.cyan(` faster than ${slowest.config.name}`)
      )
    }

    // Detailed comparison
    console.log('')
    console.log(chalk.bold('Detailed Metrics:'))

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i]
        const b = results[j]

        const avgDiff = ((a.metrics.httpReqDuration.avg - b.metrics.httpReqDuration.avg) /
          Math.min(a.metrics.httpReqDuration.avg, b.metrics.httpReqDuration.avg) * 100)
        const p95Diff = ((a.metrics.httpReqDuration.p95 - b.metrics.httpReqDuration.p95) /
          Math.min(a.metrics.httpReqDuration.p95, b.metrics.httpReqDuration.p95) * 100)

        console.log('')
        console.log(`  ${a.config.name} vs ${b.config.name}:`)

        if (Math.abs(avgDiff) < 5) {
          console.log(`    Average latency: ${chalk.yellow('Similar')} (${Math.abs(avgDiff).toFixed(1)}% diff)`)
        } else if (avgDiff > 0) {
          console.log(`    Average latency: ${chalk.green(b.config.name)} is ${Math.abs(avgDiff).toFixed(1)}% faster`)
        } else {
          console.log(`    Average latency: ${chalk.green(a.config.name)} is ${Math.abs(avgDiff).toFixed(1)}% faster`)
        }

        if (Math.abs(p95Diff) < 5) {
          console.log(`    P95 latency: ${chalk.yellow('Similar')} (${Math.abs(p95Diff).toFixed(1)}% diff)`)
        } else if (p95Diff > 0) {
          console.log(`    P95 latency: ${chalk.green(b.config.name)} is ${Math.abs(p95Diff).toFixed(1)}% better`)
        } else {
          console.log(`    P95 latency: ${chalk.green(a.config.name)} is ${Math.abs(p95Diff).toFixed(1)}% better`)
        }
      }
    }
  }

  console.log('')
  console.log(chalk.bold('='.repeat(80)))
}

async function main() {
  const { dir } = parseArgs()
  const resultsDir = path.join(ROOT_DIR, dir)

  console.log(`Loading results from: ${resultsDir}`)

  try {
    const allResults = await loadResults(resultsDir)

    if (allResults.length === 0) {
      console.log(chalk.yellow('\nNo benchmark results found.'))
      console.log('Run benchmarks first:')
      console.log('  npx tsx src/runners/run-all-benchmarks.ts')
      process.exit(0)
    }

    // Show most recent results
    console.log(chalk.dim(`\nFound ${allResults.length} benchmark run(s). Showing most recent:\n`))

    printComparison(allResults[0])

    // Show trend if multiple runs exist
    if (allResults.length > 1) {
      console.log(chalk.bold('\nHistorical Comparison (last 3 runs):'))
      console.log('-'.repeat(60))

      for (let i = 0; i < Math.min(3, allResults.length); i++) {
        const results = allResults[i]
        const timestamp = new Date(results[0].timestamp).toLocaleString()

        console.log(chalk.dim(`\nRun ${i + 1}: ${timestamp}`))
        for (const result of results) {
          console.log(
            `  ${result.config.name}: ` +
            `avg=${formatLatency(result.metrics.httpReqDuration.avg)}, ` +
            `p95=${formatLatency(result.metrics.httpReqDuration.p95)}`
          )
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(chalk.yellow(`\nResults directory not found: ${resultsDir}`))
      console.log('Run benchmarks first:')
      console.log('  npx tsx src/runners/run-all-benchmarks.ts')
    } else {
      console.error('Error:', error)
    }
    process.exit(1)
  }
}

main()
