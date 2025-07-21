# @goatlab/benchmarks

Performance benchmarking suite for comparing database drivers and ORMs using realistic workload patterns.

## Quick Start

```bash
# Run full benchmark (10 seconds per driver)
pnpm benchmark

# Run with custom duration (e.g., 30 seconds)
pnpm benchmark -- --time=30

# Run with realistic user simulation (includes think time)
pnpm benchmark:think

# Quick demo (shorter test)
pnpm benchmark:demo
```

## Available Benchmarks

### Drivers Tested
- **MySQL2** - Raw MySQL driver (callbacks)
- **MySQL2/Promise** - Promise-based MySQL driver
- **Knex** - SQL query builder
- **Kysely** - Type-safe SQL query builder
- **Drizzle** - TypeScript ORM
- **Prisma** - Type-safe ORM
- **Prisma+Kysely** - Hybrid approach
- **TypeORM** - Decorator-based ORM
- **Sequelize** - JavaScript ORM
- **MikroORM** - TypeScript ORM with Unit of Work

### Workload Patterns
- **OLTP Standard** - Mixed read/write operations (35% simple selects, 25% filtered selects, 20% joins, 15% inserts, 5% complex joins)
- **E-Commerce** - Read-heavy workload
- **Analytics** - Complex query patterns
- **High Frequency** - Ultra-low latency operations
- **Batch Processing** - Bulk operations

## Understanding Results

### Key Metrics
- **Ops/sec** - Operations per second (higher is better)
- **Latency** - Average response time in milliseconds
- **P95** - 95th percentile latency (tail performance)
- **Transaction Breakdown** - Operations by query type

### Output Example
```
Rank | Driver          | Ops/sec | Latency | P95    | Relative Performance
-----|-----------------|---------|---------|--------|--------------------
1    | MySQL2/Promise  | 1,531   | 0.65ms  | 1.55ms | 100% (Fastest)
2    | Prisma+Kysely   | 1,515   | 0.66ms  | 1.54ms | 99%
3    | Kysely          | 1,468   | 0.68ms  | 1.64ms | 96%
```

## Requirements

- Node.js 18+
- Docker (for MySQL container)
- No manual database setup required - benchmarks use Docker automatically

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

## Scripts

- `pnpm benchmark` - Full benchmark suite
- `pnpm benchmark:think` - Benchmark with realistic think time
- `pnpm benchmark:demo` - Quick demo run
- `pnpm benchmark:basic` - Original simple benchmark

All benchmarks support `--time=N` parameter to set duration in seconds.