import { BenchmarkResult, BenchmarkSuite } from '../types';
import Table from 'cli-table3';

export class BenchmarkReporter {
  formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  formatMemory(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  }

  formatOpsPerSecond(ops: number): string {
    if (ops < 1000) return `${ops.toFixed(2)} ops/s`;
    if (ops < 1000000) return `${(ops / 1000).toFixed(2)}k ops/s`;
    return `${(ops / 1000000).toFixed(2)}M ops/s`;
  }

  printResult(result: BenchmarkResult): void {
    console.log(`\n=== ${result.name} ===`);
    if (result.description) {
      console.log(`Description: ${result.description}`);
    }
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Average Time: ${this.formatTime(result.averageTime)}`);
    console.log(`Min Time: ${this.formatTime(result.minTime)}`);
    console.log(`Max Time: ${this.formatTime(result.maxTime)}`);
    console.log(`Operations/sec: ${this.formatOpsPerSecond(result.operationsPerSecond)}`);
    console.log(`Memory Change: ${this.formatMemory(result.memoryUsage.heapUsed)}`);
    console.log(`Timestamp: ${result.timestamp.toISOString()}`);
  }

  printSuite(suite: BenchmarkSuite): void {
    console.log(`\n🚀 Benchmark Suite: ${suite.name}`);
    console.log(`Environment: Node ${suite.environment.node} on ${suite.environment.platform} ${suite.environment.arch}`);
    console.log(`CPUs: ${suite.environment.cpus}, Memory: ${this.formatMemory(suite.environment.memory)}`);
    console.log(`Started: ${suite.timestamp.toISOString()}\n`);

    // Summary table
    const table = new Table({
      head: ['Benchmark', 'Avg Time', 'Ops/sec', 'Min Time', 'Max Time', 'Memory'],
      colWidths: [30, 12, 12, 12, 12, 12],
    });

    suite.results.forEach(result => {
      table.push([
        result.name,
        this.formatTime(result.averageTime),
        this.formatOpsPerSecond(result.operationsPerSecond),
        this.formatTime(result.minTime),
        this.formatTime(result.maxTime),
        this.formatMemory(result.memoryUsage.heapUsed),
      ]);
    });

    console.log(table.toString());

    // Detailed results
    suite.results.forEach(result => {
      this.printResult(result);
    });
  }

  compareResults(results: BenchmarkResult[]): void {
    if (results.length < 2) return;

    console.log('\n📊 Performance Comparison');
    
    const fastest = results.reduce((fastest, current) => 
      current.operationsPerSecond > fastest.operationsPerSecond ? current : fastest
    );

    const table = new Table({
      head: ['Benchmark', 'Ops/sec', 'Relative Performance', 'Avg Time'],
      colWidths: [25, 15, 20, 15],
    });

    results
      .sort((a, b) => b.operationsPerSecond - a.operationsPerSecond)
      .forEach(result => {
        const relative = result.operationsPerSecond / fastest.operationsPerSecond;
        const relativeText = relative === 1 ? '🏆 Fastest' : `${(relative * 100).toFixed(1)}%`;
        
        table.push([
          result.name,
          this.formatOpsPerSecond(result.operationsPerSecond),
          relativeText,
          this.formatTime(result.averageTime),
        ]);
      });

    console.log(table.toString());
  }

  exportToJson(suite: BenchmarkSuite, filename?: string): void {
    const fileName = filename || `benchmark-${Date.now()}.json`;
    const fs = require('fs');
    fs.writeFileSync(fileName, JSON.stringify(suite, null, 2));
    console.log(`\n📁 Results exported to ${fileName}`);
  }
}