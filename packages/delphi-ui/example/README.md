# Agents UI — Live Example

Runs a full agent workflow system with a visual dashboard you can interact with.

## Quick Start

```bash
# From packages/delphi-ui/
pnpm run example
```

This starts:
1. **Postgres** (testcontainer) — workflow state
2. **Redis** (testcontainer) — BullMQ queue  
3. **Backend API** on `http://localhost:4444` — workflow engine + BullMQ worker
4. **Dashboard UI** on `http://localhost:5173` — Vite dev server

## What You'll See

A 5-step SDLC pipeline: `analyze → plan → implement → review → deploy`

- Steps 1-3 auto-complete (simulated agents)
- Step 4 (`review`) **pauses for human approval** — you approve it in the UI
- Step 5 (`deploy`) runs after approval

## Explore with Playwright

```bash
# Open the Playwright inspector to click around
npx playwright open http://localhost:5173
```

## Seed Workflows

The example auto-creates 3 workflows on startup so the dashboard isn't empty.
