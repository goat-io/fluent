# Multi-stage build for the agents test-server.
# Builds the workspace once, runs from compiled dist where possible.
#
# Build:  docker build -t delphi:latest .
# Run:    docker compose up

FROM node:22-alpine AS builder
WORKDIR /repo

# Build deps for native modules (better-sqlite3, etc.) — drop after install
RUN apk add --no-cache python3 make g++ git
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile + workspace manifest first for better Docker layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY tsconfig*.json ./

# Copy only the packages we actually need (keeps the build fast and the
# image small). delphi-ui is the entrypoint; the rest are its workspace deps.
COPY packages/delphi-core packages/delphi-core
COPY packages/delphi-ui packages/delphi-ui
COPY packages/tasks-adapter-bullmq packages/tasks-adapter-bullmq
COPY packages/tasks-core packages/tasks-core
COPY packages/js-utils packages/js-utils
COPY packages/node-utils packages/node-utils
COPY packages/tsconfig packages/tsconfig

# Install the deps for those packages (pnpm filter avoids touching others)
RUN pnpm install --frozen-lockfile --prefer-offline \
  --filter @goatlab/delphi-ui... \
  --filter @goatlab/delphi-core... \
  --filter @goatlab/tasks-adapter-bullmq...

# Build everything we need in dependency order
RUN pnpm --filter @goatlab/js-utils build \
 && pnpm --filter @goatlab/node-utils build \
 && pnpm --filter @goatlab/tasks-core build \
 && pnpm --filter @goatlab/tasks-adapter-bullmq build \
 && pnpm --filter @goatlab/delphi-core build

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy the built workspace (includes node_modules with hoisted layout)
COPY --from=builder /repo /repo

WORKDIR /repo/packages/delphi-ui
EXPOSE 4445

# tsx runs the test-server. In production you'd compile and run dist/,
# but the test-server includes the wiring + executor handlers we want
# to keep togther for benchmarking parity.
CMD ["pnpm", "exec", "tsx", "test-server/server.ts"]
