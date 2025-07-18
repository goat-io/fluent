export interface BenchmarkOptions {
  name: string;
  iterations: number;
  warmupRuns: number;
  concurrency: number;
  description?: string;
}

export interface BenchmarkResult {
  name: string;
  description?: string;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  iterations: number;
  operationsPerSecond: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  description?: string;
  results: BenchmarkResult[];
  timestamp: Date;
  environment: {
    node: string;
    platform: string;
    arch: string;
    cpus: number;
    memory: number;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface BenchmarkRunner {
  run(fn: () => Promise<void>, options: BenchmarkOptions): Promise<BenchmarkResult>;
  runSuite(name: string, benchmarks: Array<{
    name: string;
    fn: () => Promise<void>;
    options?: Partial<BenchmarkOptions>;
  }>): Promise<BenchmarkSuite>;
}

export interface DatabaseBenchmark {
  name: string;
  setup(): Promise<void>;
  teardown(): Promise<void>;
  benchmark(options: BenchmarkOptions): Promise<BenchmarkResult>;
}

export interface QueryBenchmark {
  name: string;
  description: string;
  query: string;
  params?: any[];
  expectedResults?: number;
}