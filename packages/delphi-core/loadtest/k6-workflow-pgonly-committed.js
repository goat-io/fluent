// k6 Load Test — PG-Only Dispatch, Committed Durability
//
// Same as k6-workflow-committed.js but server runs with DISPATCH_MODE=pg
// (PgConnector instead of BullMQ). Same workflow (payment_critical,
// durability=committed), same endpoint (/start-async), same ramp profile.
//
// Prerequisites:
//   1. DISPATCH_MODE=pg CLUSTER_MODE=2 npx tsx test-server/server.ts
//   2. k6 run packages/delphi-core/loadtest/k6-workflow-pgonly-committed.js

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var PEAK_RPS = parseInt(__ENV.PEAK_RPS || '800', 10)
var MAX_VUS = parseInt(__ENV.MAX_VUS || '1000', 10)

var started = new Counter('pgonly_committed_started')
var latency = new Trend('pgonly_committed_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

var headers = { 'Content-Type': 'application/json' }

export var options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    pgonly_committed: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: Math.floor(MAX_VUS / 2),
      maxVUs: MAX_VUS,
      stages: [
        { target: 200, duration: '15s' },
        { target: 200, duration: '15s' },
        { target: 400, duration: '10s' },
        { target: 400, duration: '15s' },
        { target: 600, duration: '10s' },
        { target: 600, duration: '15s' },
        { target: PEAK_RPS, duration: '10s' },
        { target: PEAK_RPS, duration: '20s' },
        { target: 0, duration: '5s' },
      ],
      exec: 'startCommitted',
    },
  },
  thresholds: {
    'pgonly_committed_latency': ['p(95)<500', 'p(99)<1500'],
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
  latency.add(Date.now() - start)
  throughput.add(1)

  var ok = check(res, {
    'pgonly-cmt: 200': function (r) { return r.status === 200 },
    'pgonly-cmt: runId': function (r) {
      try { return !!JSON.parse(r.body).runId } catch (e) { return false }
    },
    'pgonly-cmt: COMMITTED': function (r) {
      try { return JSON.parse(r.body).status === 'COMMITTED' } catch (e) { return false }
    },
  })
  if (ok) started.add(1)
  errorRate.add(!ok)
}

export function handleSummary(data) {
  var m = data.metrics
  var count = (m.pgonly_committed_started && m.pgonly_committed_started.values && m.pgonly_committed_started.values.count) || 0
  var total = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var v = (m.pgonly_committed_latency && m.pgonly_committed_latency.values) || {}
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var durSec = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 115
  var avgRps = durSec > 0 ? Math.round(total / durSec) : 0

  return {
    stdout: '\n' +
      '==========================================================\n' +
      '  PG-ONLY + COMMITTED (payment_critical, no Redis)\n' +
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
