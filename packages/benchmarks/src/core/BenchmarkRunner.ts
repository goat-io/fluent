import { performance } from 'perf_hooks';
import { BenchmarkOptions, BenchmarkResult, BenchmarkSuite, BenchmarkRunner } from '../types';
import os from 'os';

export class DefaultBenchmarkRunner implements BenchmarkRunner {
  private defaultOptions: BenchmarkOptions = {
    name: 'Benchmark',
    iterations: 1000,
    warmupRuns: 100,
    concurrency: 1,
  };

  async run(fn: () => Promise<void>, options: BenchmarkOptions): Promise<BenchmarkResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Warmup runs
    for (let i = 0; i < opts.warmupRuns; i++) {
      await fn();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const times: number[] = [];
    const startMemory = process.memoryUsage();
    
    // Main benchmark runs
    for (let i = 0; i < opts.iterations; i++) {
      const startTime = performance.now();
      
      if (opts.concurrency === 1) {
        await fn();
      } else {
        // Run concurrent operations
        const promises = Array.from({ length: opts.concurrency }, () => fn());
        await Promise.all(promises);
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const endMemory = process.memoryUsage();
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
    };

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const operationsPerSecond = 1000 / averageTime * opts.concurrency;

    return {
      name: opts.name,
      description: opts.description,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      iterations: opts.iterations,
      operationsPerSecond,
      memoryUsage: memoryDiff,
      timestamp: new Date(),
    };
  }

  async runSuite(
    name: string,
    benchmarks: Array<{
      name: string;
      fn: () => Promise<void>;
      options?: Partial<BenchmarkOptions>;
    }>
  ): Promise<BenchmarkSuite> {
    const results: BenchmarkResult[] = [];
    
    for (const benchmark of benchmarks) {
      const options = { ...this.defaultOptions, ...benchmark.options, name: benchmark.name };
      const result = await this.run(benchmark.fn, options);
      results.push(result);
    }

    return {
      name,
      results,
      timestamp: new Date(),
      environment: {
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: os.totalmem(),
      },
    };
  }
}

export function createBenchmarkRunner(): BenchmarkRunner {
  return new DefaultBenchmarkRunner();
}