// k6 Breakpoint Test — Find the ceiling of buffered dispatch
//
// Ramps aggressively from 1k to 10k req/s to find where errors start.
// Run twice: once with DISPATCH_MODE=redis, once with DISPATCH_MODE=pg.
//
// Usage:
//   DISPATCH_MODE=redis CLUSTER_MODE=2 npx tsx test-server/server.ts
//   k6 run packages/delphi-core/loadtest/k6-breakpoint.js
//
//   DISPATCH_MODE=pg CLUSTER_MODE=2 npx tsx test-server/server.ts
//   k6 run packages/delphi-core/loadtest/k6-breakpoint.js

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

var BASE_URL = __ENV.API_URL || 'http://localhost:4444'
var MAX_VUS = parseInt(__ENV.MAX_VUS || '2000', 10)

var started = new Counter('started')
var latency = new Trend('start_latency', true)
var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

// Per-stage counters for sustained rate measurement
var at1k = new Counter('at_1k')
var at2k = new Counter('at_2k')
var at3k = new Counter('at_3k')
var at4k = new Counter('at_4k')
var at5k = new Counter('at_5k')
var at6k = new Counter('at_6k')
var at8k = new Counter('at_8k')
var at10k = new Counter('at_10k')

var headers = { 'Content-Type': 'application/json' }

export var options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 500,
      timeUnit: '1s',
      preAllocatedVUs: Math.floor(MAX_VUS / 2),
      maxVUs: MAX_VUS,
      stages: [
        { target: 1000, duration: '10s' },   // ramp to 1k
        { target: 1000, duration: '10s' },   // sustain 1k
        { target: 2000, duration: '5s' },    // ramp to 2k
        { target: 2000, duration: '10s' },   // sustain 2k
        { target: 3000, duration: '5s' },    // ramp to 3k
        { target: 3000, duration: '10s' },   // sustain 3k
        { target: 4000, duration: '5s' },    // ramp to 4k
        { target: 4000, duration: '10s' },   // sustain 4k
        { target: 5000, duration: '5s' },    // ramp to 5k
        { target: 5000, duration: '10s' },   // sustain 5k
        { target: 6000, duration: '5s' },    // ramp to 6k
        { target: 6000, duration: '10s' },   // sustain 6k
        { target: 8000, duration: '5s' },    // ramp to 8k
        { target: 8000, duration: '10s' },   // sustain 8k
        { target: 10000, duration: '5s' },   // ramp to 10k
        { target: 10000, duration: '10s' },  // sustain 10k
        { target: 0, duration: '5s' },       // ramp down
      ],
      exec: 'startWorkflow',
    },
  },
  thresholds: {
    // No hard thresholds — we WANT to see where it breaks
    'error_rate': ['rate<1.0'],  // permissive — just prevent k6 from aborting
  },
}

// Track elapsed seconds for per-stage bucketing
var testStart = Date.now()

export function startWorkflow() {
  var payload = JSON.stringify({
    workflowName: 'fast_single',
    input: { ts: Date.now() },
  })

  var start = Date.now()
  var res = http.post(BASE_URL + '/workflows/start-async', payload, { headers: headers })
  var elapsed = Date.now() - start
  latency.add(elapsed)
  throughput.add(1)

  var ok = check(res, {
    'status 200': function (r) { return r.status === 200 },
  })
  if (ok) started.add(1)
  errorRate.add(!ok)

  // Per-stage bucketing (coarse — based on time since test start)
  var secSinceStart = (Date.now() - testStart) / 1000
  if (secSinceStart < 20) at1k.add(1)
  else if (secSinceStart < 35) at2k.add(1)
  else if (secSinceStart < 50) at3k.add(1)
  else if (secSinceStart < 65) at4k.add(1)
  else if (secSinceStart < 80) at5k.add(1)
  else if (secSinceStart < 95) at6k.add(1)
  else if (secSinceStart < 110) at8k.add(1)
  else at10k.add(1)
}

export function handleSummary(data) {
  var m = data.metrics
  var total = (m.total_requests && m.total_requests.values && m.total_requests.values.count) || 0
  var ok = (m.started && m.started.values && m.started.values.count) || 0
  var v = (m.start_latency && m.start_latency.values) || {}
  var errRate = (m.error_rate && m.error_rate.values && m.error_rate.values.rate) || 0
  var durSec = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs / 1000 : 130

  var c1k = (m.at_1k && m.at_1k.values && m.at_1k.values.count) || 0
  var c2k = (m.at_2k && m.at_2k.values && m.at_2k.values.count) || 0
  var c3k = (m.at_3k && m.at_3k.values && m.at_3k.values.count) || 0
  var c4k = (m.at_4k && m.at_4k.values && m.at_4k.values.count) || 0
  var c5k = (m.at_5k && m.at_5k.values && m.at_5k.values.count) || 0
  var c6k = (m.at_6k && m.at_6k.values && m.at_6k.values.count) || 0
  var c8k = (m.at_8k && m.at_8k.values && m.at_8k.values.count) || 0
  var c10k = (m.at_10k && m.at_10k.values && m.at_10k.values.count) || 0

  return {
    stdout: '\n' +
      '══════════════════════════════════════════════════════════════\n' +
      '  BREAKPOINT TEST — BUFFERED DISPATCH\n' +
      '══════════════════════════════════════════════════════════════\n' +
      '\n' +
      '  Total requests:  ' + total + '\n' +
      '  Succeeded:       ' + ok + '\n' +
      '  Avg RPS:         ~' + Math.round(total / durSec) + '\n' +
      '  Error rate:      ' + (errRate * 100).toFixed(2) + '%\n' +
      '\n' +
      '  Latency:\n' +
      '    p50:  ' + Math.round(v['p(50)'] || 0) + 'ms\n' +
      '    p90:  ' + Math.round(v['p(90)'] || 0) + 'ms\n' +
      '    p95:  ' + Math.round(v['p(95)'] || 0) + 'ms\n' +
      '    p99:  ' + Math.round(v['p(99)'] || 0) + 'ms\n' +
      '    max:  ' + Math.round(v.max || 0) + 'ms\n' +
      '\n' +
      '  Per-stage throughput (sustained reqs in each stage):\n' +
      '    @1k target:   ' + c1k + ' reqs in 20s  (~' + Math.round(c1k / 20) + '/s)\n' +
      '    @2k target:   ' + c2k + ' reqs in 15s  (~' + Math.round(c2k / 15) + '/s)\n' +
      '    @3k target:   ' + c3k + ' reqs in 15s  (~' + Math.round(c3k / 15) + '/s)\n' +
      '    @4k target:   ' + c4k + ' reqs in 15s  (~' + Math.round(c4k / 15) + '/s)\n' +
      '    @5k target:   ' + c5k + ' reqs in 15s  (~' + Math.round(c5k / 15) + '/s)\n' +
      '    @6k target:   ' + c6k + ' reqs in 15s  (~' + Math.round(c6k / 15) + '/s)\n' +
      '    @8k target:   ' + c8k + ' reqs in 15s  (~' + Math.round(c8k / 15) + '/s)\n' +
      '    @10k target:  ' + c10k + ' reqs in 15s  (~' + Math.round(c10k / 15) + '/s)\n' +
      '\n' +
      '══════════════════════════════════════════════════════════════\n',
  }
}
