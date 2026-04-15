#!/usr/bin/env bash
# loadtest.sh — full lifecycle: bring up Postgres+Redis, push schema,
#               start the example server, run a k6 sweep, verify drain,
#               tear everything down (unless KEEP_RUNNING=1).
#
# Usage:
#   ./scripts/loadtest.sh                          # default sweep
#   RATE=5000 DUR=60s ./scripts/loadtest.sh        # tweak load
#   KEEP_RUNNING=1 ./scripts/loadtest.sh           # leave stack up after
#   SWEEP="2000 4000 5000" ./scripts/loadtest.sh   # multi-rate sweep
#
# Requires: docker compose, k6, tsx (via package), pnpm

set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
SWEEP="${SWEEP:-2000 4000 5000}"
DUR="${DUR:-30s}"
KEEP_RUNNING="${KEEP_RUNNING:-0}"

# ── colors ──
GREEN="\033[0;32m"; RED="\033[0;31m"; CYAN="\033[0;36m"; RESET="\033[0m"
say()  { printf "${CYAN}==>${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${RESET}  %s\n" "$*"; }
fail() { printf "${RED}✗${RESET}  %s\n" "$*" >&2; }

# ── prereq checks ──
command -v k6 >/dev/null || { fail "k6 not installed (brew install k6)"; exit 1; }
command -v docker >/dev/null || { fail "docker not installed"; exit 1; }
command -v pnpm >/dev/null || { fail "pnpm not installed"; exit 1; }
command -v bun >/dev/null || { fail "bun not installed (curl -fsSL https://bun.sh/install | bash)"; exit 1; }

cleanup() {
  local exit_code=$?
  if [ "$KEEP_RUNNING" = "1" ]; then
    say "KEEP_RUNNING=1 — leaving stack up. Tear down with: pnpm infra:down"
    exit $exit_code
  fi
  say "Cleaning up..."
  # Kill the server tree (cluster primary + all workers)
  if [ -n "${SERVER_PID:-}" ]; then
    pkill -P "$SERVER_PID" 2>/dev/null || true
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "bun.*src/server.ts" 2>/dev/null || true
  pnpm infra:down >/dev/null 2>&1 || true
  exit $exit_code
}
trap cleanup EXIT INT TERM

# ── 1. bring up infra ──
say "Bringing up Postgres + Redis (docker compose up -d)..."
pnpm infra:up >/dev/null
ok "Infra up"

# ── 2. wait for healthy ──
say "Waiting for Postgres + Redis healthy..."
for i in $(seq 1 30); do
  # Count "Health":"healthy" occurrences (works on both per-line and array json formats)
  healthy_count=$(docker compose ps --format json 2>/dev/null | { grep -o '"Health":"healthy"' || true; } | wc -l | tr -d ' ')
  if [ "$healthy_count" = "2" ]; then
    ok "Infra healthy"; break
  fi
  sleep 1
  if [ "$i" = "30" ]; then fail "Infra didn't become healthy in 30s"; exit 1; fi
done

# ── 3. push schema (idempotent — Prisma db push) ──
say "Pushing Prisma schema (creates 'agents' schema + engine tables)..."
DATABASE_URL="postgresql://agents:agents@localhost:5432/agents_example?schema=public" \
  pnpm db:push --accept-data-loss >/dev/null
ok "Schema applied"

# ── 4. start example server in background ──
say "Starting Express + agents server on :$PORT..."
DATABASE_URL="postgresql://agents:agents@localhost:5432/agents_example?schema=public" \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
PORT="$PORT" \
TENANT_ID=demo-tenant \
PG_POOL_SIZE="${PG_POOL_SIZE:-20}" \
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-50}" \
CLUSTER_MODE="${CLUSTER_MODE:-2}" \
  pnpm start > /tmp/delphi-example-server.log 2>&1 &
SERVER_PID=$!

# Wait for it to be ready
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
    ok "Server ready (pid=$SERVER_PID)"; break
  fi
  sleep 1
  if [ "$i" = "30" ]; then
    fail "Server didn't come up in 30s. Last 20 log lines:"
    tail -20 /tmp/delphi-example-server.log
    exit 1
  fi
done

# ── 5. sanity check — fire one workflow, verify it completes ──
say "Smoke test: starting one workflow, verifying it reaches COMPLETED..."
RESP=$(curl -sf -X POST "http://localhost:$PORT/api/workflows/start-async" \
  -H 'Content-Type: application/json' \
  -d '{"workflowName":"fast_single","input":{"smoke":true}}')
RID=$(echo "$RESP" | sed -n 's/.*"runId":"\([^"]*\)".*/\1/p')
if [ -z "$RID" ]; then fail "Smoke test failed — no runId. Got: $RESP"; exit 1; fi
sleep 2
STATUS=$(curl -sf -X POST "http://localhost:$PORT/api/workflows/status" \
  -H 'Content-Type: application/json' \
  -d "{\"runId\":\"$RID\"}" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
if [ "$STATUS" != "COMPLETED" ]; then
  fail "Smoke test failed — runId=$RID is in state '$STATUS' (expected COMPLETED)"
  exit 1
fi
ok "Smoke test passed (runId=$RID → COMPLETED)"

# ── 6. k6 sweep ──
say "Running k6 sweep: rates=[$SWEEP], duration=$DUR each"
echo
for RATE in $SWEEP; do
  printf "${CYAN}═══ RATE=$RATE req/s, $DUR ═══${RESET}\n"
  API_URL="http://localhost:$PORT" MODE=async RATE="$RATE" DUR="$DUR" \
    k6 run --quiet scripts/k6-flat.js
  echo
  sleep 2
done

# ── 7. verify drain — no data loss ──
say "Verifying durability (waiting up to 3 min for full drain)..."
PG=$(docker compose ps -q postgres)
REDIS=$(docker compose ps -q redis)

PREV_COMPLETED=0
STABLE_TICKS=0
for i in $(seq 1 18); do
  WAIT_Q=$(docker exec "$REDIS" redis-cli LLEN "demo-tenant:bull:workflow_ingest:wait" 2>/dev/null || echo 0)
  STEP_Q=$(docker exec "$REDIS" redis-cli LLEN "demo-tenant:bull:workflow_step_light:wait" 2>/dev/null || echo 0)
  RUNS=$(docker exec "$PG" psql -U agents -d agents_example -tA -c 'SELECT count(*) FROM agents.workflow_runs;' 2>/dev/null || echo 0)
  COMPLETED=$(docker exec "$PG" psql -U agents -d agents_example -tA -c "SELECT count(*) FROM agents.workflow_runs WHERE status='COMPLETED';" 2>/dev/null || echo 0)
  FAILED=$(docker exec "$REDIS" redis-cli ZCARD "demo-tenant:bull:workflow_ingest:failed" 2>/dev/null || echo 0)
  printf "  t+%2ds | ingest_q=%6s step_q=%6s | runs=%6s completed=%6s | failed=%s\n" \
    "$((i*10))" "$WAIT_Q" "$STEP_Q" "$RUNS" "$COMPLETED" "$FAILED"
  if [ "$WAIT_Q" = "0" ] && [ "$STEP_Q" = "0" ] && [ "$COMPLETED" = "$RUNS" ]; then
    if [ "$COMPLETED" = "$PREV_COMPLETED" ]; then
      STABLE_TICKS=$((STABLE_TICKS + 1))
      if [ "$STABLE_TICKS" -ge 2 ]; then break; fi
    fi
  fi
  PREV_COMPLETED="$COMPLETED"
  sleep 10
done

# ── 8. final report ──
echo
say "Final state:"
RUNS=$(docker exec "$PG" psql -U agents -d agents_example -tA -c 'SELECT count(*) FROM agents.workflow_runs;' 2>/dev/null)
COMPLETED=$(docker exec "$PG" psql -U agents -d agents_example -tA -c "SELECT count(*) FROM agents.workflow_runs WHERE status='COMPLETED';" 2>/dev/null)
FAILED_RUNS=$(docker exec "$PG" psql -U agents -d agents_example -tA -c "SELECT count(*) FROM agents.workflow_runs WHERE status='FAILED';" 2>/dev/null)
FAILED=$(docker exec "$REDIS" redis-cli ZCARD "demo-tenant:bull:workflow_ingest:failed" 2>/dev/null || echo 0)

printf "  Total runs in PG:        %s\n" "$RUNS"
printf "  Completed runs:          %s\n" "$COMPLETED"
printf "  Failed runs:             %s\n" "$FAILED_RUNS"
printf "  BullMQ failed jobs:      %s\n" "$FAILED"

if [ "$COMPLETED" = "$RUNS" ] && [ "$FAILED" = "0" ]; then
  ok "Zero data loss — every accepted workflow reached COMPLETED in PG"
  exit 0
else
  fail "Drain incomplete or failures detected (completed=$COMPLETED, total=$RUNS, failed_jobs=$FAILED)"
  exit 1
fi
