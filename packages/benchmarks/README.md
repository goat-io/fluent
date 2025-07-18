# Database Benchmarks

Performance benchmarking suite for database tools and approaches using HammerDB patterns.

## 🚀 Quick Start

### Run Full Benchmark (All 10 Drivers)

```bash
# Pure throughput testing (default: 10 seconds per driver)
pnpm benchmark

# Custom duration (e.g., 30 seconds per driver)
pnpm benchmark -- --time=30

# Realistic user simulation with think time
pnpm benchmark:think

# Show help
pnpm benchmark -- --help
```

### Run Demo (Same 10 Drivers, Shorter Test)

```bash
# Quick demo - pure throughput (default: 10 seconds)
pnpm benchmark:demo

# Custom duration (e.g., 3 seconds per driver)
pnpm benchmark:demo -- --time=3

# Quick demo - with think time
pnpm benchmark:demo:think
```

### Run Original Benchmark (Baseline)

```bash
# Original simple benchmark for comparison
pnpm benchmark:basic
```

## Installation

```bash
# Install dependencies
pnpm install

# Build the package (optional)
pnpm build
```

**No database setup required** - benchmarks use Docker containers automatically!

## 📊 What Gets Tested

### 10 Database Drivers/ORMs

1. **MySQL2** - Raw MySQL driver (callbacks)
2. **MySQL2/Promise** - Promise-based MySQL driver
3. **Knex** - SQL query builder
4. **Prisma** - Type-safe ORM
5. **Kysely** - Type-safe SQL query builder
6. **Drizzle** - TypeScript ORM
7. **Prisma+Kysely** - Hybrid approach combining Prisma's connection with Kysely's query builder
8. **TypeORM** - Decorator-based ORM
9. **Sequelize** - JavaScript ORM
10. **MikroORM** - TypeScript ORM with Unit of Work pattern

### HammerDB Patterns

- **Transaction Mix**: 35% simple selects, 25% filtered selects, 20% joins, 15% inserts, 5% complex joins
- **Think Time**: Simulates realistic user behavior with delays
- **Percentile Metrics**: P95 latencies for tail performance analysis
- **Connection Pooling**: Realistic connection management
- **Comprehensive Schema**: Full e-commerce database with relationships

## 🎯 Latest Benchmark Results (30-Second Test)

### 🏆 Performance Rankings

Based on our latest 30-second benchmark run with pure throughput (no think time):

| Rank | Driver             | Ops/sec | Latency | P95    | Relative Performance |
| ---- | ------------------ | ------- | ------- | ------ | -------------------- |
| 🥇 1 | **MySQL2/Promise** | 1,531   | 0.65ms  | 1.55ms | 100% (Fastest) ✨    |
| 🥈 2 | **Prisma+Kysely**  | 1,515   | 0.66ms  | 1.54ms | 99%                  |
| 🥉 3 | **Kysely**         | 1,468   | 0.68ms  | 1.64ms | 96%                  |
| 4    | **Knex**           | 1,284   | 0.78ms  | 1.78ms | 84%                  |
| 5    | **MySQL2**         | 1,249   | 0.80ms  | 1.76ms | 82%                  |
| 6    | **Drizzle**        | 1,199   | 0.83ms  | 1.83ms | 78%                  |
| 7    | **Sequelize**      | 1,146   | 0.87ms  | 1.94ms | 75%                  |
| 8    | **MikroORM**       | 938     | 1.07ms  | 2.63ms | 61%                  |
| 9    | **Prisma**         | 858     | 1.16ms  | 2.48ms | 56%                  |
| 10   | **TypeORM**        | 824     | 1.21ms  | 2.85ms | 54%                  |

### 📊 Transaction Breakdown (Top 5 Performers)

| Transaction Type | MySQL2/Promise | Prisma+Kysely | Kysely | Knex   | MySQL2 |
| ---------------- | -------------- | ------------- | ------ | ------ | ------ |
| Simple Select    | 16,012         | 15,843        | 15,504 | 13,637 | 13,100 |
| Filtered Select  | 11,598         | 11,404        | 11,020 | 9,521  | 9,343  |
| Join Query       | 9,166          | 9,108         | 8,884  | 7,673  | 7,440  |
| Complex Join     | 2,233          | 2,334         | 2,164  | 1,936  | 1,915  |
| Insert           | 6,918          | 6,750         | 6,468  | 5,754  | 5,679  |

### 🚀 Key Insights

1. **MySQL2/Promise is the champion** - The promise-based MySQL driver delivers the best performance at 1,531 ops/sec
2. **Prisma+Kysely surprisingly fast** - This hybrid approach (99% of fastest) shows you can have type safety without sacrificing much performance
3. **Pure drivers dominate** - The top 3 spots are taken by drivers with minimal abstraction
4. **ORMs have overhead** - Full ORMs like Prisma (56%), TypeORM (54%), and MikroORM (61%) show significant performance penalties
5. **All drivers are production-ready** - Even the "slowest" driver (TypeORM) handles 824 ops/sec, which is excellent for most applications

### Working Drivers: 10/10 ✅

All drivers are now fully functional! Previously failing drivers have been fixed:

- **Prisma+Kysely** - Fixed connection setup and import issues
- **MikroORM** - Updated to v6 configuration format

## 🎨 Choosing the Right Driver

### For Maximum Performance

- **MySQL2/Promise** - When you need absolute best performance and don't mind writing raw SQL
- **Prisma+Kysely** - Best of both worlds: Prisma's schema management with Kysely's fast query building
- **Kysely** - Type-safe queries with minimal overhead

### For Developer Experience

- **Prisma** - Best-in-class developer experience, automatic migrations, type safety (56% of raw performance)
- **Drizzle** - Modern TypeScript ORM with good performance (78% of raw performance)
- **Knex** - Battle-tested query builder with extensive ecosystem (84% of raw performance)

### For Specific Needs

- **TypeORM** - If you need decorators and extensive features (54% of raw performance)
- **Sequelize** - For JavaScript projects or legacy codebases (75% of raw performance)
- **MikroORM** - If you like the Unit of Work pattern (61% of raw performance)

## 📈 Results Explanation

### Key Metrics

- **Ops/sec**: Operations per second (higher is better)
- **Latency**: Average response time (lower is better)
- **P95**: 95th percentile latency - tail performance (lower is better)
- **Errors**: Failed operations (lower is better)
- **Transaction Mix**: Breakdown by query type

### Pure vs Realistic

- **Pure Throughput**: Shows maximum driver performance
- **Realistic Simulation**: Includes user think time for real-world scenarios
- **Massive Difference**: ~200-300x difference between pure and realistic!

## 🛠️ Environment

- **Database**: MySQL 8.0 (Docker container)
- **Node.js**: 18+
- **Test Duration**: Configurable (default: 10 seconds, benchmark above used 30 seconds)
- **Connection Pool**: 10 connections per driver
- **Data Set**: 1,000 users, 500 products, 1,000 orders
- **Hardware**: Results may vary based on your system

## 🔬 Reproducing These Results

To get results similar to those shown above:

```bash
# Run the exact same 30-second benchmark
pnpm benchmark -- --time=30

# For quick testing (3 seconds)
pnpm benchmark:demo -- --time=3

# For production-like testing (60 seconds)
pnpm benchmark -- --time=60
```

**Note**: Results will vary based on your hardware, but relative performance between drivers should remain consistent.

## 🔧 Development

```bash
# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

## 🚨 Troubleshooting

### Docker Issues

- Make sure Docker is running
- Check Docker permissions

### Driver Failures

- Some drivers may fail due to missing dependencies or configuration issues
- This is normal - shows which drivers work reliably in your environment

### Performance Variations

- Results may vary based on system resources and Docker performance
- Run multiple times for consistent results

## 📂 Files

- `enhanced-all-drivers.ts` - Full benchmark (all 10 drivers)
- `enhanced-demo.ts` - Demo benchmark (same drivers, shorter)
- `containerized-benchmark.ts` - Original benchmark
- `transaction-types.ts` - HammerDB workload definitions
- `ENHANCED_BENCHMARKS.md` - Detailed documentation

## 📄 License

MIT License - see LICENSE file for details.
