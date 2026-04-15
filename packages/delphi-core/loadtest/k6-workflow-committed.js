// k6 Load Test — Committed Durability Throughput
//
// Measures sustainable throughput of workflows marked durability('committed'):
// HTTP /start-async returns ONLY after the workflow_runs row has been
// COPY-FROM'd and COMMIT'd to Postgres (no in-memory buffer ack).
//
// Compare against k6-workflow.js (which exercises the buffered fast path).
// Expectation: committed is ~10-30x slower per request (one flush window +
// COPY time per caller) but should still sustain hundreds of req/s per
// Node process thanks to BatchedJobProcessor amortizing COPY transactions.
//
// Prerequisites:
//   1. Start test server: cd packages/delphi-ui && npx tsx test-server/server.ts
//      (must include the `payment_critical` workflow — added alongside this file)
//   2. Run: k6 run packages/delphi-core/loadtest/k6-workflow-committed.js
//
// Knobs (env vars):
//   API_URL         default http://localhost:4444
//   PEAK_RPS        peak target req/s for the sustain stage (default 800)
//   MAX_VUS         cap on concurrent VUs (default 1000 — committed requests
//                   hold the connection for ~30-80ms so you need more VUs
//                   than the buffered test)

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var TENANT = __ENV.TENANT_ID || 'e2e-ui-tenant'
var PEAK_RPS = parseInt(__ENV.PEAK_RPS || '800', 10)
var MAX_VUS = parseInt(__ENV.MAX_VUS || '1000', 10)

var committedStarted = new Counter('committed_started')
var committedLatency = new Trend('committed_start_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

// Per-stage throughput buckets so the summary can show sustained rate at
// each target rate rather than a single average blurred across the ramp.
var rpsAt200 = new Counter('rps_at_200')
var rpsAt400 = new Counter('rps_at_400')
var rpsAt600 = new Counter('rps_at_600')
var rpsAtPeak = new Counter('rps_at_peak')

var headers = { 'Content-Type': 'application/json' }

export var options = {
  // Expose p(50) and p(99) in summary — defaults give only med/p(90)/p(95).
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],

  scenarios: {
    committed_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: Math.floor(MAX_VUS / 2),
      maxVUs: MAX_VUS,
      stages: [
        { target: 200, duration: '15s' },       // warm-up + 200 rps
        { target: 200, duration: '15s' },       // sustain at 200
        { target: 400, duration: '10s' },       // ramp to 400
        { target: 400, duration: '15s' },       // sustain at 400
        { target: 600, duration: '10s' },       // ramp to 600
        { target: 600, duration: '15s' },       // sustain at 600
        { target: PEAK_RPS, duration: '10s' },  // ramp to peak
        { target: PEAK_RPS, duration: '20s' },  // sustain at peak
        { target: 0, duration: '5s' },          // ramp down
      ],
      exec: 'startCommitted',
    },
  },

  thresholds: {
    // Committed path is slower by design (~30-80ms typical). Thresholds
    // are sized to catch pathological degradation, not to gate on the
    // absolute numbers — those are what we're measuring.
    'committed_start_latency': ['p(95)<500', 'p(99)<1500'],
    'error_rate': ['rate<0.02'],
  },
}

export function startCommitted() {
  var payload = JSON.stringify({
    workflowName: 'payment_critical',
    input: { amountCents: 4200, ts: Date.now() },
  })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/start-async', payload, { headers: headers })
  var elapsed = Date.now() - start
  committedLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'committed: 200': function (r) { return r.status === 200 },
    'committed: has runId': function (r) {
      try { return !!JSON.parse(r.body).runId } catch (e) { return false }
    },
    'committed: status=COMMITTED': function (r) {
      try { return JSON.parse(r.body).status === 'COMMITTED' } catch (e) { return false }
    },
  })

  if (ok) {
    committedStarted.add(1)
    // Elapsed time from test start — k6's execution.scenario.iterationInTest
    // would be cleaner but is v0.40+; Date.now() comparison is fine for
    // per-phase bucketing.
    var iterInTest = (typeof __ITER !== 'undefined') ? __ITER : 0
    // Coarse phase detection via current VU rate — for a precise per-phase
    // RPS readout, use k6 summary's `iteration_duration` per stage, or
    // re-run with separate scenarios. These counters are a rough indicator.
    if (iterInTest < 30) rpsAt200.add(1)
    else if (iterInTest < 60) rpsAt400.add(1)
    else if (iterInTest < 90) rpsAt600.add(1)
    else rpsAtPeak.add(1)
  }
  errorRate.add(!ok)
}

export function handleSummary(data) {
  var m = data.metrics
  var started = (m.committed_started && m.committed_started.values && m.committed_started.values.count) || 0
  var total = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var p50 = (m.committed_start_latency && m.committed_start_latency.values && m.committed_start_latency.values['p(50)']) || 0
  var p95 = (m.committed_start_latency && m.committed_start_latency.values && m.committed_start_latency.values['p(95)']) || 0
  var p99 = (m.committed_start_latency && m.committed_start_latency.values && m.committed_start_latency.values['p(99)']) || 0
  var pMax = (m.committed_start_latency && m.committed_start_latency.values && m.committed_start_latency.values.max) || 0
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var durSec = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 60
  var avgRps = durSec > 0 ? Math.round(total / durSec) : 0

  return {
    stdout: '\n' +
      '==========================================================\n' +
      '  COMMITTED DURABILITY LOAD TEST RESULTS\n' +
      '  (HTTP blocks until PG COMMIT — payment_critical workflow)\n' +
      '==========================================================\n' +
      '\n' +
      '  Peak target RPS:       ' + PEAK_RPS + '\n' +
      '  Total requests:        ' + total + '\n' +
      '  Committed starts:      ' + started + '\n' +
      '  Avg achieved RPS:      ~' + avgRps + ' req/sec (across full test)\n' +
      '  Error rate:            ' + (errRate * 100).toFixed(2) + '%\n' +
      '\n' +
      '  --- Committed Start Latency ---\n' +
      '  p50:  ' + Math.round(p50) + 'ms\n' +
      '  p95:  ' + Math.round(p95) + 'ms\n' +
      '  p99:  ' + Math.round(p99) + 'ms\n' +
      '  max:  ' + Math.round(pMax) + 'ms\n' +
      '\n' +
      '  Note: the committed path is intentionally slower than buffered.\n' +
      '  Each request waits one BatchedJobProcessor flush window (~20ms)\n' +
      '  + one COPY FROM + COMMIT (~10-30ms on native PG). Throughput\n' +
      '  ceiling is limited by committedMaxConcurrentFlushes and PG pool\n' +
      '  headroom, not by per-request work.\n' +
      '\n' +
      '==========================================================\n',
  }
}
