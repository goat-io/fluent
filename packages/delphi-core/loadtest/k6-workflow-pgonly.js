// k6 Load Test — PG-Only Dispatch, Buffered Durability
//
// Same as k6-workflow-buffered.js but server runs with DISPATCH_MODE=pg
// (PgConnector instead of BullMQ). Same workflow (fast_single, durability=buffered),
// same endpoint (/start-async), same ramp profile.
//
// Prerequisites:
//   1. DISPATCH_MODE=pg CLUSTER_MODE=2 npx tsx test-server/server.ts
//   2. k6 run packages/delphi-core/loadtest/k6-workflow-pgonly.js

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var PEAK_RPS = parseInt(__ENV.PEAK_RPS || '4000', 10)
var MAX_VUS = parseInt(__ENV.MAX_VUS || '500', 10)

var started = new Counter('pgonly_buffered_started')
var latency = new Trend('pgonly_buffered_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

var headers = { 'Content-Type': 'application/json' }

export var options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    pgonly_buffered: {
      executor: 'ramping-arrival-rate',
      startRate: 200,
      timeUnit: '1s',
      preAllocatedVUs: Math.floor(MAX_VUS / 2),
      maxVUs: MAX_VUS,
      stages: [
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
    'pgonly_buffered_latency': ['p(95)<100', 'p(99)<300'],
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
  latency.add(Date.now() - start)
  throughput.add(1)

  var ok = check(res, {
    'pgonly-buf: 200': function (r) { return r.status === 200 },
    'pgonly-buf: runId': function (r) {
      try { return !!JSON.parse(r.body).runId } catch (e) { return false }
    },
  })
  if (ok) started.add(1)
  errorRate.add(!ok)
}

export function handleSummary(data) {
  var m = data.metrics
  var count = (m.pgonly_buffered_started && m.pgonly_buffered_started.values && m.pgonly_buffered_started.values.count) || 0
  var total = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var v = (m.pgonly_buffered_latency && m.pgonly_buffered_latency.values) || {}
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var durSec = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 115
  var avgRps = durSec > 0 ? Math.round(total / durSec) : 0

  return {
    stdout: '\n' +
      '==========================================================\n' +
      '  PG-ONLY + BUFFERED (fast_single, no Redis)\n' +
      '==========================================================\n' +
      '  Peak target:   ' + PEAK_RPS + ' req/s\n' +
      '  Started:       ' + count + '\n' +
      '  Avg RPS:       ~' + avgRps + '\n' +
      '  Error rate:    ' + (errRate * 100).toFixed(2) + '%\n' +
      '  p50:  ' + Math.round(v['p(50)'] || 0) + 'ms\n' +
      '  p95:  ' + Math.round(v['p(95)'] || 0) + 'ms\n' +
      '  p99:  ' + Math.round(v['p(99)'] || 0) + 'ms\n' +
      '  max:  ' + Math.round(v.max || 0) + 'ms\n' +
      '==========================================================\n',
  }
}
