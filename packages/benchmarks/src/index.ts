export * from './types';
export * from './core/BenchmarkRunner';
export * from './core/Reporter';
export * from './core/EnhancedReporter';
export * from './core/ComparisonEngine';
export * from './core/QuickComparison';
export * from './database/connections';
export * from './containers/ContainerizedConnections';
export * from './setup/seedData';
export * from './benchmarks/mysql2-vs-prisma';
export * from './benchmarks/containerized-benchmark';
export * from './visualization/PerformanceChart';
export * from './utils/containerHelpers';

// Re-export main classes for easy access
export { createBenchmarkRunner } from './core/BenchmarkRunner';
export { BenchmarkReporter } from './core/Reporter';
export { EnhancedBenchmarkReporter } from './core/EnhancedReporter';
export { ComparisonEngine } from './core/ComparisonEngine';
export { QuickComparison } from './core/QuickComparison';
export { DatabaseConnections } from './database/connections';
export { ContainerizedConnections } from './containers/ContainerizedConnections';
export { SeedData } from './setup/seedData';
export { MySQL2VsPrismaBenchmark } from './benchmarks/mysql2-vs-prisma';
export { ContainerizedBenchmarkRunner } from './benchmarks/containerized-benchmark';
export { PerformanceChart } from './visualization/PerformanceChart';