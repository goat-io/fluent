// npx vitest run ./src/server/services/util/benchmarker.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeBenchmarkResults, type BenchmarkResult } from './benchmarker'

describe('benchmarker', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* suppress console in test */
    })
    vi.spyOn(console, 'table').mockImplementation(() => {
      /* suppress console in test */
    })
  })

  describe('analyzeBenchmarkResults', () => {
    it('should parse and analyze benchmark results correctly', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Task A',
          'Latency avg (ns)': '100.50 ± 10.2',
          'Latency med (ns)': '95.30 ± 5.1',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 25.0',
          Samples: 100
        },
        {
          'Task name': 'Task B',
          'Latency avg (ns)': '200.75 ± 20.5',
          'Latency med (ns)': '190.25 ± 15.3',
          'Throughput avg (ops/s)': '500.00 ± 30.0',
          'Throughput med (ops/s)': '480.00 ± 20.0',
          Samples: 150
        },
        {
          'Task name': 'Task C',
          'Latency avg (ns)': '50.25 ± 5.0',
          'Latency med (ns)': '48.75 ± 3.2',
          'Throughput avg (ops/s)': '2000.00 ± 100.0',
          'Throughput med (ops/s)': '1950.00 ± 75.0',
          Samples: 200
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(3)

      // Task C should be the best performer (lowest latency, highest throughput)
      expect(result[0].name).toBe('Task C')
      expect(result[0].latencyImprovement).toBe(0) // Best latency gets 0% improvement
      expect(result[0].throughputImprovement).toBe(0) // Best throughput gets 0% improvement

      // Task A should be middle performer
      expect(result[1].name).toBe('Task A')
      expect(result[1].latencyImprovement).toBeLessThan(0) // Worse than best, so negative improvement

      // Task B should be the worst performer
      expect(result[2].name).toBe('Task B')
      expect(result[2].latencyImprovement).toBeLessThan(
        result[1].latencyImprovement
      )
    })

    it('should handle single benchmark result', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Single Task',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 25.0',
          Samples: 100
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Single Task')
      expect(result[0].latencyImprovement).toBe(0)
      expect(result[0].throughputImprovement).toBe(0)
    })

    it('should handle identical benchmark results', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Task A',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 25.0',
          Samples: 100
        },
        {
          'Task name': 'Task B',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 25.0',
          Samples: 100
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(2)
      expect(result[0].latencyImprovement).toBe(0)
      expect(result[0].throughputImprovement).toBe(0)
      expect(result[1].latencyImprovement).toBe(0)
      expect(result[1].throughputImprovement).toBe(0)
    })

    it('should parse values without error margins correctly', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Task A',
          'Latency avg (ns)': '100.50',
          'Latency med (ns)': '95.30',
          'Throughput avg (ops/s)': '1000.00',
          'Throughput med (ops/s)': '950.00',
          Samples: 100
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Task A')
      expect(result[0].latencyImprovement).toBe(0)
      expect(result[0].throughputImprovement).toBe(0)
    })

    it('should handle decimal values correctly', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Fast Task',
          'Latency avg (ns)': '0.50 ± 0.05',
          'Latency med (ns)': '0.45 ± 0.02',
          'Throughput avg (ops/s)': '10000.50 ± 500.0',
          'Throughput med (ops/s)': '9500.25 ± 250.0',
          Samples: 1000
        },
        {
          'Task name': 'Slow Task',
          'Latency avg (ns)': '1.75 ± 0.15',
          'Latency med (ns)': '1.60 ± 0.10',
          'Throughput avg (ops/s)': '5000.25 ± 200.0',
          'Throughput med (ops/s)': '4800.75 ± 150.0',
          Samples: 500
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Fast Task')
      expect(result[1].name).toBe('Slow Task')

      // Fast task should have better (0%) improvement
      expect(result[0].latencyImprovement).toBe(0)
      expect(result[0].throughputImprovement).toBe(0)

      // Slow task should have negative improvements
      expect(result[1].latencyImprovement).toBeLessThan(0)
      expect(result[1].throughputImprovement).toBeLessThan(0)
    })

    it('should calculate improvements correctly', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Best Latency',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '500.00 ± 25.0',
          'Throughput med (ops/s)': '480.00 ± 20.0',
          Samples: 100
        },
        {
          'Task name': 'Best Throughput',
          'Latency avg (ns)': '200.00 ± 10.0',
          'Latency med (ns)': '190.00 ± 8.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 40.0',
          Samples: 150
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(2)

      // Best latency task
      const bestLatencyTask = result.find(r => r.name === 'Best Latency')
      expect(bestLatencyTask).toBeDefined()
      expect(bestLatencyTask!.latencyImprovement).toBe(0) // Best latency
      expect(bestLatencyTask!.throughputImprovement).toBe(-50) // 50% worse throughput

      // Best throughput task
      const bestThroughputTask = result.find(r => r.name === 'Best Throughput')
      expect(bestThroughputTask).toBeDefined()
      expect(bestThroughputTask!.latencyImprovement).toBe(-100) // 100% worse latency
      expect(bestThroughputTask!.throughputImprovement).toBe(0) // Best throughput
    })

    it('should sort results by latency improvement (best to worst)', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Worst',
          'Latency avg (ns)': '300.00 ± 15.0',
          'Latency med (ns)': '290.00 ± 12.0',
          'Throughput avg (ops/s)': '300.00 ± 15.0',
          'Throughput med (ops/s)': '280.00 ± 10.0',
          Samples: 50
        },
        {
          'Task name': 'Best',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 40.0',
          Samples: 200
        },
        {
          'Task name': 'Middle',
          'Latency avg (ns)': '200.00 ± 10.0',
          'Latency med (ns)': '190.00 ± 8.0',
          'Throughput avg (ops/s)': '500.00 ± 25.0',
          'Throughput med (ops/s)': '480.00 ± 20.0',
          Samples: 100
        }
      ]

      const result = analyzeBenchmarkResults(mockResults)

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Best')
      expect(result[1].name).toBe('Middle')
      expect(result[2].name).toBe('Worst')

      // Improvements should be in descending order
      expect(result[0].latencyImprovement).toBeGreaterThanOrEqual(
        result[1].latencyImprovement
      )
      expect(result[1].latencyImprovement).toBeGreaterThanOrEqual(
        result[2].latencyImprovement
      )
    })

    it('should call console.log and console.table', () => {
      const mockResults: BenchmarkResult[] = [
        {
          'Task name': 'Test Task',
          'Latency avg (ns)': '100.00 ± 5.0',
          'Latency med (ns)': '95.00 ± 3.0',
          'Throughput avg (ops/s)': '1000.00 ± 50.0',
          'Throughput med (ops/s)': '950.00 ± 25.0',
          Samples: 100
        }
      ]

      analyzeBenchmarkResults(mockResults)

      expect(console.log).toHaveBeenCalledWith({
        parsedResults: expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Task',
            latencyAvg: 100,
            latencyMed: 95,
            throughputAvg: 1000,
            throughputMed: 950,
            samples: 100
          })
        ])
      })

      expect(console.table).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Task Name': 'Test Task',
            'Latency Improvement (%)': '0.00',
            'Throughput Improvement (%)': '0.00'
          })
        ])
      )
    })

    it('should handle empty results array', () => {
      const result = analyzeBenchmarkResults([])

      expect(result).toEqual([])
      expect(console.log).toHaveBeenCalledWith({ parsedResults: [] })
      expect(console.table).toHaveBeenCalledWith([])
    })
  })
})
