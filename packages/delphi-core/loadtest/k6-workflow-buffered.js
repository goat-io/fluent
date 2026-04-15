// k6 Load Test — Buffered Durability Throughput
//
// Apples-to-apples counterpart to k6-workflow-committed.js. Same endpoint
// (/start-async), same ramp profile, same test server — only the workflow
// changes: fast_single has durability unset (defaults to 'buffered') so the
// HTTP handler returns as soon as the trigger hits IngestBuffer in memory.
// The downstream flush → addBulk → IngestWorker → COPY FROM → PG chain
// happens async.
//
// Compare sustained RPS and p95 latency with k6-workflow-committed.js to
// quantify the durability tax under identical load + identical cluster size.
//
// Prerequisites:
//   1. Start test server: cd packages/delphi-ui && CLUSTER_MODE=2 npx tsx test-server/server.ts
//   2. Run: k6 run packages/delphi-core/loadtest/k6-workflow-buffered.js
//
// Knobs (env vars):
//   API_URL         default http://localhost:4444
//   PEAK_RPS        peak target req/s for the sustain stage (default 4000)
//   MAX_VUS         cap on concurrent VUs (default 500 — buffered returns
//                   in ~1-2ms so few VUs are needed even at high RPS)

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var TENANT = __ENV.TENANT_ID || 'e2e-ui-tenant'
var PEAK_RPS = parseInt(__ENV.PEAK_RPS || '4000', 10)
var MAX_VUS = parseInt(__ENV.MAX_VUS || '500', 10)

var bufferedStarted = new Counter('buffered_started')
var bufferedLatency = new Trend('buffered_start_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

var headers = { 'Content-Type': 'application/json' }

export var options = {
  // Expose p(50) and p(99) in summary — defaults give only med/p(90)/p(95).
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],

  scenarios: {
    buffered_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 200,
      timeUnit: '1s',
      preAllocatedVUs: Math.floor(MAX_VUS / 2),
      maxVUs: MAX_VUS,
      stages: [
        // Mirror the committed test ramp profile so direct comparison is fair.
        { target: 500, duration: '15s' },
        { target: 500, duration: '15s' },
        { target: 1000, duration: '10s' },
        { target: 1000, duration: '15s' },
        { target: 2000, duration: '10s' },
        { target: 2000, duration: '15s' },
        { target: PEAK_RPS, duration: '10s' },
        { target: PEAK_RPS, duration: '20s' },
        { target: 0, duration: '5s' },
      ],
      exec: 'startBuffered',
    },
  },

  thresholds: {
    // Buffered HTTP response is ~1-2ms. Anything over 50ms p95 signals
    // back-pressure in the IngestBuffer (flush can't keep up).
    'buffered_start_latency': ['p(95)<100', 'p(99)<300'],
    'error_rate': ['rate<0.01'],
  },
}

export function startBuffered() {
  var payload = JSON.stringify({
    workflowName: 'fast_single',
    input: { ts: Date.now() },
  })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/start-async', payload, { headers: headers })
  var elapsed = Date.now() - start
  bufferedLatency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'buffered: 200': function (r) { return r.status === 200 },
    'buffered: has runId': function (r) {
      try { return !!JSON.parse(r.body).runId } catch (e) { return false }
    },
    'buffered: status=QUEUED': function (r) {
      try { return JSON.parse(r.body).status === 'QUEUED' } catch (e) { return false }
    },
  })

  if (ok) bufferedStarted.add(1)
  errorRate.add(!ok)
}

export function handleSummary(data) {
  var m = data.metrics
  var started = (m.buffered_started && m.buffered_started.values && m.buffered_started.values.count) || 0
  var total = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var v = (m.buffered_start_latency && m.buffered_start_latency.values) || {}
  var p50 = v['p(50)'] || v.med || 0
  var p90 = v['p(90)'] || 0
  var p95 = v['p(95)'] || 0
  var p99 = v['p(99)'] || 0
  var pMax = v.max || 0
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var durSec = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 115
  var avgRps = durSec > 0 ? Math.round(total / durSec) : 0

  return {
    stdout: '\n' +
      '==========================================================\n' +
      '  BUFFERED DURABILITY LOAD TEST RESULTS\n' +
      '  (HTTP returns once trigger hits in-memory buffer — fast_single)\n' +
      '==========================================================\n' +
      '\n' +
      '  Peak target RPS:       ' + PEAK_RPS + '\n' +
      '  Total requests:        ' + total + '\n' +
      '  Buffered starts:       ' + started + '\n' +
      '  Avg achieved RPS:      ~' + avgRps + ' req/sec (across full test)\n' +
      '  Error rate:            ' + (errRate * 100).toFixed(2) + '%\n' +
      '\n' +
      '  --- Buffered Start Latency ---\n' +
      '  p50:  ' + Math.round(p50) + 'ms\n' +
      '  p90:  ' + Math.round(p90) + 'ms\n' +
      '  p95:  ' + Math.round(p95) + 'ms\n' +
      '  p99:  ' + Math.round(p99) + 'ms\n' +
      '  max:  ' + Math.round(pMax) + 'ms\n' +
      '\n' +
      '==========================================================\n',
  }
}
