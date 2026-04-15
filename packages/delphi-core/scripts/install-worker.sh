#!/bin/bash
set -euo pipefail

echo "======================================"
echo "  Goat Agents Worker — Install Script"
echo "======================================"
echo ""

# ── Check Node.js ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Please install Node.js >= 18."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js >= 18 required (found v$(node -v))."
  exit 1
fi
echo "[OK] Node.js $(node -v)"

# ── Check npm ────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not installed."
  exit 1
fi
echo "[OK] npm $(npm -v)"

# ── Install package ──────────────────────────────────────────────────
echo ""
echo "Installing @goatlab/delphi-core..."
npm install -g @goatlab/delphi-core 2>/dev/null || {
  echo "WARN: Global install failed, trying local install..."
  npm install @goatlab/delphi-core
}
echo "[OK] @goatlab/delphi-core installed"

# ── Prompt for configuration ─────────────────────────────────────────
echo ""
echo "Configure your worker environment:"
echo ""

read -rp "Redis URL [redis://localhost:6379]: " REDIS_URL
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

read -rp "Engine API URL [http://localhost:3000]: " ENGINE_URL
ENGINE_URL="${ENGINE_URL:-http://localhost:3000}"

read -rp "Tenant ID [default]: " TENANT_ID
TENANT_ID="${TENANT_ID:-default}"

read -rp "Worker name [$(hostname)]: " WORKER_NAME
WORKER_NAME="${WORKER_NAME:-$(hostname)}"

read -rp "Worker auth token (optional): " WORKER_TOKEN

# ── Write .env ───────────────────────────────────────────────────────
ENV_FILE=".env.delphi-worker"
cat > "$ENV_FILE" <<ENVEOF
# Goat Agents Worker Configuration
AGENTS_REDIS_URL=$REDIS_URL
AGENTS_ENGINE_URL=$ENGINE_URL
AGENTS_TENANT_ID=$TENANT_ID
AGENTS_WORKER_NAME=$WORKER_NAME
AGENTS_WORKER_TOKEN=$WORKER_TOKEN
ENVEOF

echo ""
echo "[OK] Configuration written to $ENV_FILE"

# ── Detect capabilities ──────────────────────────────────────────────
echo ""
echo "Detected capabilities:"
echo "  CPUs:   $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 'unknown')"
echo "  Memory: $(free -m 2>/dev/null | awk '/Mem:/{print $2}' || sysctl -n hw.memsize 2>/dev/null | awk '{printf "%d", $1/1024/1024}' || echo 'unknown') MB"
if [ -S /var/run/docker.sock ] || docker info &>/dev/null 2>&1; then
  echo "  Docker: available"
else
  echo "  Docker: not available (sandbox queue disabled)"
fi
if command -v nvidia-smi &>/dev/null; then
  echo "  GPU:    available"
else
  echo "  GPU:    not detected"
fi

echo ""
echo "======================================"
echo "  Installation complete!"
echo ""
echo "  Start the worker with:"
echo "    source $ENV_FILE && npx goat-delphi-worker"
echo "======================================"
