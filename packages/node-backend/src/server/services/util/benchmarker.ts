export interface BenchmarkResult {
  'Task name': string
  'Latency avg (ns)': string
  'Latency med (ns)': string
  'Throughput avg (ops/s)': string
  'Throughput med (ops/s)': string

  Samples: number
}

export function analyzeBenchmarkResults(results: BenchmarkResult[]) {
  const parseValue = (value: string): number =>
    Number.parseFloat(value.split(' ± ')[0])

  // Extract numeric values
  const parsedResults = results.map(r => ({
    name: r['Task name'],
    latencyAvg: parseValue(r['Latency avg (ns)']),
    latencyMed: parseValue(r['Latency med (ns)']),
    throughputAvg: parseValue(r['Throughput avg (ops/s)']),
    throughputMed: parseValue(r['Throughput med (ops/s)']),
    samples: r.Samples,
  }))

  console.log({ parsedResults })

  // Find the best performers
  const bestLatency = Math.min(...parsedResults.map(r => r.latencyAvg)) // Lower is better
  const bestThroughput = Math.max(...parsedResults.map(r => r.throughputAvg)) // Higher is better

  // Calculate improvements
  const analysis = parsedResults.map(r => ({
    name: r.name,
    latencyImprovement: ((bestLatency - r.latencyAvg) / bestLatency) * 100, // Lower is better
    throughputImprovement:
      ((r.throughputAvg - bestThroughput) / bestThroughput) * 100, // Higher is better
  }))

  // Sort results from best to worst (by latency)
  const sortedAnalysis = analysis.sort(
    (a, b) => b.latencyImprovement - a.latencyImprovement,
  )

  console.table(
    sortedAnalysis.map(
      ({ name, latencyImprovement, throughputImprovement }) => ({
        'Task Name': name,
        'Latency Improvement (%)': latencyImprovement.toFixed(2),
        'Throughput Improvement (%)': throughputImprovement.toFixed(2),
      }),
    ),
  )

  return sortedAnalysis
}
