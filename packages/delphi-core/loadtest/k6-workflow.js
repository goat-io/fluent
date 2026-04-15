// k6 Load Test — Workflow Engine Throughput Benchmark
//
// Prerequisites:
//   1. Start test server: cd packages/delphi-ui && npx tsx test-server/server.ts
//   2. Run: k6 run packages/delphi-core/loadtest/k6-workflow.js
//
// Target: 1500+ req/sec (Hatchet benchmark)
//
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var TENANT = __ENV.TENANT_ID || 'e2e-ui-tenant'

// Custom metrics
var workflowsStarted = new Counter('workflows_started')
var workflowsCompleted = new Counter('workflows_completed')
var eventsIngested = new Counter('events_ingested')
var startLatency = new Trend('workflow_start_latency', true)
var statusLatency = new Trend('status_check_latency', true)
var eventLatency = new Trend('event_ingest_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

var batchStarted = new Counter('batch_workflows_started')
var batchLatency = new Trend('batch_start_latency', true)

var headers = { 'Content-Type': 'application/json' }

export var options = {
  scenarios: {
    // Scenario 1: Workflow start throughput (the main benchmark)
    workflow_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      stages: [
        { target: 500, duration: '10s' },   // Ramp to 500/sec
        { target: 1000, duration: '10s' },  // Ramp to 1000/sec
        { target: 1500, duration: '10s' },  // Ramp to 1500/sec
        { target: 2000, duration: '10s' },  // Push to 2000/sec
        { target: 2000, duration: '15s' },  // Sustain
        { target: 0, duration: '5s' },      // Ramp down
      ],
      exec: 'startFastWorkflow',
    },

    // Scenario 2: Event ingestion throughput
    event_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 200,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 300,
      stages: [
        { target: 1000, duration: '10s' },
        { target: 2000, duration: '10s' },
        { target: 2000, duration: '20s' },
        { target: 0, duration: '5s' },
      ],
      exec: 'ingestEvent',
      startTime: '5s',
    },

    // Scenario 3: Batch workflow starts (Hatchet pattern)
    batch_starts: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 50, duration: '10s' },
        { target: 100, duration: '10s' },
        { target: 100, duration: '20s' },
        { target: 0, duration: '5s' },
      ],
      exec: 'startBatch',
      startTime: '5s',
    },

    // Scenario 4: Status polling (read throughput)
    status_reads: {
      executor: 'constant-vus',
      vus: 20,
      duration: '55s',
      exec: 'pollStatus',
      startTime: '5s',
    },
  },

  thresholds: {
    'workflow_start_latency': ['p(95)<200', 'p(99)<500'],
    'event_ingest_latency': ['p(95)<100', 'p(99)<300'],
    'status_check_latency': ['p(95)<200'],
    'error_rate': ['rate<0.10'],
  },
}

// Track created workflow IDs for status polling
var runIds = []

export function startFastWorkflow() {
  var payload = JSON.stringify({
    workflowName: 'fast_single',
    input: { ts: Date.now() },
  })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/start', payload, { headers: headers })
  var elapsed = Date.now() - start
  startLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'start: 200': function(r) { return r.status === 200 },
  })

  if (ok) {
    workflowsStarted.add(1)
    try {
      var body = JSON.parse(res.body)
      if (body.runId && runIds.length < 500) {
        runIds.push(body.runId)
      }
    } catch (e) {}
  }
  errorRate.add(!ok)
}

export function ingestEvent() {
  var idx = Math.floor(Math.random() * 10000000)
  var payload = JSON.stringify({
    eventType: 'k6.load.test',
    source: 'k6',
    payload: { index: idx, ts: Date.now() },
    idempotencyKey: 'k6-' + idx + '-' + Date.now(),
  })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/ingest-event', payload, { headers: headers })
  var elapsed = Date.now() - start
  eventLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'event: 200': function(r) { return r.status === 200 },
  })

  if (ok) eventsIngested.add(1)
  errorRate.add(!ok)
}

export function pollStatus() {
  if (runIds.length === 0) {
    sleep(0.2)
    return
  }

  var runId = runIds[Math.floor(Math.random() * runIds.length)]
  var payload = JSON.stringify({ runId: runId })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/status', payload, { headers: headers })
  var elapsed = Date.now() - start
  statusLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'status: 200': function(r) { return r.status === 200 },
  })

  if (res.status === 200) {
    try {
      var body = JSON.parse(res.body)
      if (body.status === 'COMPLETED') workflowsCompleted.add(1)
    } catch (e) {}
  }

  errorRate.add(!ok)
  sleep(0.05)
}

export function startBatch() {
  // Batch of 50 workflows in a single request
  var workflows = []
  for (var i = 0; i < 50; i++) {
    workflows.push({
      workflowName: 'fast_single',
      input: { batch: true, i: i, ts: Date.now() },
    })
  }

  var payload = JSON.stringify({ workflows: workflows })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/start-batch', payload, { headers: headers })
  var elapsed = Date.now() - start
  batchLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'batch: 200': function(r) { return r.status === 200 },
  })

  if (ok) {
    batchStarted.add(50) // 50 workflows per batch
    try {
      var body = JSON.parse(res.body)
      if (Array.isArray(body)) {
        for (var j = 0; j < Math.min(body.length, 10); j++) {
          if (body[j].runId && runIds.length < 500) runIds.push(body[j].runId)
        }
      }
    } catch (e) {}
  }
  errorRate.add(!ok)
}

export function handleSummary(data) {
  var m = data.metrics
  var wfStarted = (m.workflows_started && m.workflows_started.values && m.workflows_started.values.count) || 0
  var wfCompleted = (m.workflows_completed && m.workflows_completed.values && m.workflows_completed.values.count) || 0
  var evIngested = (m.events_ingested && m.events_ingested.values && m.events_ingested.values.count) || 0
  var totalReqs = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var startP50 = (m.workflow_start_latency && m.workflow_start_latency.values && m.workflow_start_latency.values['p(50)']) || 0
  var startP95 = (m.workflow_start_latency && m.workflow_start_latency.values && m.workflow_start_latency.values['p(95)']) || 0
  var startP99 = (m.workflow_start_latency && m.workflow_start_latency.values && m.workflow_start_latency.values['p(99)']) || 0
  var eventP95 = (m.event_ingest_latency && m.event_ingest_latency.values && m.event_ingest_latency.values['p(95)']) || 0
  var statusP95 = (m.status_check_latency && m.status_check_latency.values && m.status_check_latency.values['p(95)']) || 0
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var duration = (m.iteration_duration && m.iteration_duration.values && m.iteration_duration.values.med) || 0

  var batchWfs = (m.batch_workflows_started && m.batch_workflows_started.values && m.batch_workflows_started.values.count) || 0
  var batchP95 = (m.batch_start_latency && m.batch_start_latency.values && m.batch_start_latency.values['p(95)']) || 0
  var totalWfs = wfStarted + batchWfs
  var rps = totalReqs > 0 ? Math.round(totalReqs / 60) : 0
  var wfps = totalWfs > 0 ? Math.round(totalWfs / 60) : 0

  return {
    stdout: '\n' +
      '==========================================================\n' +
      '  WORKFLOW ENGINE LOAD TEST RESULTS\n' +
      '==========================================================\n' +
      '\n' +
      '  Workflows (single):   ' + wfStarted + '\n' +
      '  Workflows (batch):    ' + batchWfs + '\n' +
      '  Workflows (total):    ' + totalWfs + '\n' +
      '  Workflows completed:  ' + wfCompleted + '\n' +
      '  Events ingested:      ' + evIngested + '\n' +
      '  Total HTTP requests:  ' + totalReqs + '\n' +
      '  HTTP throughput:      ~' + rps + ' req/sec\n' +
      '  Workflow throughput:  ~' + wfps + ' workflows/sec\n' +
      '  Error rate:           ' + (errRate * 100).toFixed(2) + '%\n' +
      '\n' +
      '  --- Workflow Start Latency ---\n' +
      '  p50:  ' + Math.round(startP50) + 'ms\n' +
      '  p95:  ' + Math.round(startP95) + 'ms\n' +
      '  p99:  ' + Math.round(startP99) + 'ms\n' +
      '\n' +
      '  --- Event Ingest Latency ---\n' +
      '  p95:  ' + Math.round(eventP95) + 'ms\n' +
      '\n' +
      '  --- Status Check Latency ---\n' +
      '  p95:  ' + Math.round(statusP95) + 'ms\n' +
      '\n' +
      '==========================================================\n',
  }
}
