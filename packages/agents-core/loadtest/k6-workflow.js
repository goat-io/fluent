// k6 Load Test for Workflow Engine HTTP API
//
// Prerequisites:
//   1. Start the test server: cd packages/agents-ui && npx tsx test-server/server.ts
//   2. Run: k6 run packages/agents-core/loadtest/k6-workflow.js
//
// Scenarios:
//   - workflow_starts: Concurrent workflow creation
//   - event_ingestion: High-volume webhook events
//   - status_polling: Read-heavy status checks
//
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.API_URL || 'http://localhost:4444'
const TENANT = __ENV.TENANT_ID || 'e2e-ui-tenant'

// Custom metrics
const workflowStarted = new Counter('workflows_started')
const workflowCompleted = new Counter('workflows_completed')
const eventIngested = new Counter('events_ingested')
const startLatency = new Trend('workflow_start_latency', true)
const statusLatency = new Trend('status_check_latency', true)
const eventLatency = new Trend('event_ingest_latency', true)
const errorRate = new Rate('error_rate')

export const options = {
  scenarios: {
    // Scenario 1: Sustained workflow creation
    workflow_starts: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 20, duration: '10s' },  // Ramp to 20 starts/sec
        { target: 50, duration: '10s' },  // Ramp to 50 starts/sec
        { target: 50, duration: '20s' },  // Sustain 50/sec
        { target: 0, duration: '5s' },    // Ramp down
      ],
      exec: 'startWorkflow',
    },

    // Scenario 2: High-volume event ingestion
    event_ingestion: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 100, duration: '10s' },  // Ramp to 100 events/sec
        { target: 200, duration: '10s' },  // Ramp to 200/sec
        { target: 200, duration: '20s' },  // Sustain 200/sec
        { target: 0, duration: '5s' },     // Ramp down
      ],
      exec: 'ingestEvent',
      startTime: '5s', // Start after workflows begin
    },

    // Scenario 3: Status polling (read-heavy)
    status_polling: {
      executor: 'constant-vus',
      vus: 10,
      duration: '40s',
      exec: 'pollStatus',
      startTime: '5s',
    },
  },

  thresholds: {
    'workflow_start_latency': ['p(95)<500', 'p(99)<1000'],
    'event_ingest_latency': ['p(95)<200', 'p(99)<500'],
    'status_check_latency': ['p(95)<300', 'p(99)<500'],
    'error_rate': ['rate<0.05'], // Less than 5% errors
  },
}

const headers = { 'Content-Type': 'application/json' }

// Track created workflow IDs for status polling
const runIds = []

export function startWorkflow() {
  const payload = JSON.stringify({
    workflowName: 'demo_pipeline',
    input: { feedback: `k6 load test ${Date.now()}` },
  })

  const start = Date.now()
  const res = http.post(`${BASE_URL}/workflows/start`, payload, { headers })
  startLatency.add(Date.now() - start)

  const success = check(res, {
    'start: status 200': (r) => r.status === 200,
    'start: has runId': (r) => {
      try { return JSON.parse(r.body).runId !== undefined } catch (e) { return false }
    },
  })

  if (success) {
    workflowStarted.add(1)
    try {
      const body = JSON.parse(res.body)
      if (body.runId) runIds.push(body.runId)
    } catch (e) {}
  }
  errorRate.add(!success)
}

export function ingestEvent() {
  const idx = Math.floor(Math.random() * 1000000)
  const payload = JSON.stringify({
    tenantId: TENANT,
    eventType: 'k6.load.test',
    source: 'k6',
    payload: { index: idx, timestamp: Date.now() },
    idempotencyKey: `k6-event-${idx}`,
  })

  const start = Date.now()
  const res = http.post(`${BASE_URL}/workflows/ingest-event`, payload, { headers })
  eventLatency.add(Date.now() - start)

  const success = check(res, {
    'event: status 200': (r) => r.status === 200,
  })

  if (success) eventIngested.add(1)
  errorRate.add(!success)
}

export function pollStatus() {
  // Pick a random workflow to check
  if (runIds.length === 0) {
    sleep(0.5)
    return
  }

  const runId = runIds[Math.floor(Math.random() * runIds.length)]
  const payload = JSON.stringify({ runId })

  const start = Date.now()
  const res = http.post(`${BASE_URL}/workflows/status`, payload, { headers })
  statusLatency.add(Date.now() - start)

  const success = check(res, {
    'status: 200': (r) => r.status === 200,
    'status: has steps': (r) => {
      try { return JSON.parse(r.body).steps !== undefined } catch (e) { return false }
    },
  })

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body)
      if (body.status === 'COMPLETED') workflowCompleted.add(1)
    } catch (e) {}
  }

  errorRate.add(!success)
  sleep(0.1)
}

export function handleSummary(data) {
  var m = data.metrics
  var wfStarted = (m.workflows_started && m.workflows_started.values && m.workflows_started.values.count) || 0
  var wfCompleted = (m.workflows_completed && m.workflows_completed.values && m.workflows_completed.values.count) || 0
  var evIngested = (m.events_ingested && m.events_ingested.values && m.events_ingested.values.count) || 0
  var startP95 = (m.workflow_start_latency && m.workflow_start_latency.values && m.workflow_start_latency.values['p(95)']) || 0
  var eventP95 = (m.event_ingest_latency && m.event_ingest_latency.values && m.event_ingest_latency.values['p(95)']) || 0
  var statusP95 = (m.status_check_latency && m.status_check_latency.values && m.status_check_latency.values['p(95)']) || 0

  return {
    stdout: `
╔══════════════════════════════════════════════════╗
║           LOAD TEST RESULTS                      ║
╠══════════════════════════════════════════════════╣
║ Workflows started:  ${String(wfStarted).padStart(10)}                  ║
║ Workflows completed: ${String(wfCompleted).padStart(9)}                  ║
║ Events ingested:    ${String(evIngested).padStart(10)}                  ║
╠══════════════════════════════════════════════════╣
║ Start latency p95:  ${String(Math.round(startP95)).padStart(7)}ms                  ║
║ Event latency p95:  ${String(Math.round(eventP95)).padStart(7)}ms                  ║
║ Status latency p95: ${String(Math.round(statusP95)).padStart(7)}ms                  ║
╚══════════════════════════════════════════════════╝
`,
  }
}
