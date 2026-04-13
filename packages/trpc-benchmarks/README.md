# @goatlab/trpc-benchmarks

Performance benchmarks for tRPC APIs comparing **Express + Node.js** vs **Hono + Bun**.

## Prerequisites

### Required

- **Node.js** >= 20.0.0
- **k6** - Load testing tool ([installation guide](https://k6.io/docs/getting-started/installation/))

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### Optional (for Bun benchmarks)

- **Bun** - Fast JavaScript runtime ([installation guide](https://bun.sh/docs/installation))

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

```bash
cd packages/trpc-benchmarks
pnpm install
```

## Quick Start

### Run All Benchmarks

Run both Express+Node and Hono+Bun benchmarks sequentially:

```bash
pnpm bench:all
```

With custom options:

```bash
# More virtual users and longer duration
npx tsx src/runners/run-all-benchmarks.ts --vus 50 --duration 60s

# Quick mode (simplified scenarios)
npx tsx src/runners/run-all-benchmarks.ts --quick
```

### Run Individual Benchmarks

```bash
# Express + Node.js only
pnpm bench:k6:express

# Hono + Bun only
pnpm bench:k6:hono
```

### Compare Results

After running benchmarks, compare saved results:

```bash
pnpm bench:compare
```

## Manual Testing

### Start Servers Independently

```bash
# Express + Node.js (port 3001)
pnpm dev:express

# Hono + Bun (port 3002) - requires Bun
pnpm dev:hono
```

### Run k6 Directly

```bash
# Against Express server
k6 run --vus 10 --duration 30s --env BASE_URL=http://localhost:3001 src/k6/benchmark.js

# Against Hono server
k6 run --vus 10 --duration 30s --env BASE_URL=http://localhost:3002 src/k6/benchmark.js

# Quick benchmark (simpler scenarios)
k6 run --vus 10 --duration 30s --env BASE_URL=http://localhost:3001 src/k6/quick-benchmark.js
```

## Benchmark Scenarios

### Full Benchmark (`benchmark.js`)

Three test scenarios run sequentially:

1. **Smoke Test** (10s) - Basic functionality validation
   - Health check, ping, server info

2. **Load Test** (90s) - Sustained normal load
   - Ramps from 0 → 10 → 20 VUs
   - Mix of queries and mutations
   - User CRUD operations
   - Paginated list queries
   - Light computation

3. **Stress Test** (70s) - Find breaking points
   - Ramps up to 100 VUs
   - Rapid-fire requests
   - Batch operations
   - Large data transfers
   - CPU-intensive computation

### Quick Benchmark (`quick-benchmark.js`)

Single scenario for rapid comparison:
- Ping endpoint (minimal overhead)
- User queries with input validation
- Mutations (create operations)
- Paginated list queries

## API Endpoints

The shared tRPC router includes these endpoints:

| Endpoint | Type | Description |
|----------|------|-------------|
| `ping` | Query | Simple "pong" response |
| `health` | Query | Health check with timestamp |
| `info` | Query | Runtime info (node/bun version) |
| `user.get` | Query | Get user by ID |
| `user.create` | Mutation | Create new user |
| `user.list` | Query | List all users |
| `user.batch` | Query | Batch get users |
| `items.list` | Query | Paginated items with filtering |
| `items.all` | Query | All items (large response) |
| `items.count` | Query | Item count |
| `compute.fibonacci` | Query | CPU-bound calculation |
| `compute.isPrime` | Query | Prime number check |
| `compute.hash` | Query | Simulated work |
| `compute.sort` | Query | Array sorting benchmark |
| `echo` | Mutation | Echo payload back |

## Metrics

k6 collects the following custom metrics:

- `trpc_ping_latency` - Ping endpoint latency
- `trpc_health_latency` - Health check latency
- `trpc_user_get_latency` - User query latency
- `trpc_user_create_latency` - User mutation latency
- `trpc_items_list_latency` - List query latency
- `trpc_compute_latency` - Computation latency
- `trpc_error_rate` - Error rate percentage
- `trpc_requests` - Total request count

### Thresholds

Default pass/fail thresholds:
- 95th percentile < 500ms
- 99th percentile < 1000ms
- Ping P95 < 50ms
- Error rate < 1%

## Output

Results are saved to `results/` directory:

- `benchmark-{timestamp}.txt` - Human-readable summary
- `benchmark-{timestamp}.json` - Machine-readable data

## CLI Options

### `run-all-benchmarks.ts`

| Option | Default | Description |
|--------|---------|-------------|
| `--vus` | 10 | Number of virtual users |
| `--duration` | 30s | Test duration |
| `--quick` | false | Use simplified quick benchmark |
| `--output` | results | Output directory |

### `run-express-benchmark.ts` / `run-hono-benchmark.ts`

| Option | Default | Description |
|--------|---------|-------------|
| `--vus` | 10 | Number of virtual users |
| `--duration` | 30s | Test duration |
| `--quick` | false | Use simplified quick benchmark |

### `compare-results.ts`

| Option | Default | Description |
|--------|---------|-------------|
| `--dir` | results | Results directory to read from |

## Example Output

```
================================================================================
tRPC API Benchmark Results
================================================================================

Timestamp: 2024-01-15T10:30:00.000Z

--------------------------------------------------------------------------------
Summary Comparison
--------------------------------------------------------------------------------

Server                    Avg (ms)    P95 (ms)    P99 (ms)    Requests      Req/s
-------------------------------------------------------------------------------------
Express + Node.js            2.45        5.12        8.34       15234         507
Hono + Bun                   1.23        2.56        4.12       28456         948

--------------------------------------------------------------------------------
Performance Comparison
--------------------------------------------------------------------------------

Hono + Bun is 49.8% faster (avg latency)
Hono + Bun has 50.0% better P95 latency
Hono + Bun handled 86.8% more requests

================================================================================
```

## Notes

- Benchmarks should be run on a quiet system for accurate results
- Results may vary based on hardware, OS, and system load
- The Hono+Bun benchmark requires Bun to be installed for accurate comparison
- If Bun is not available, Hono will run on Node.js (not representative of Bun performance)
