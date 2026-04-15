// k6 flat-rate load test for the Express + delphi-express example app.
//
// Run via:  pnpm loadtest
// Or directly:
//   API_URL=http://localhost:3000 MODE=async RATE=2000 DUR=30s k6 run scripts/k6-flat.js

import { check } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

var BASE = __ENV.API_URL || "http://localhost:3000";
var RATE = parseInt(__ENV.RATE || "2000", 10);
var DUR = __ENV.DUR || "30s";
var MODE = __ENV.MODE || "async"; // 'async' | 'single'
var WORKFLOW = __ENV.WORKFLOW || "fast_single";

var lat = new Trend("lat", true);
var ok = new Counter("ok");
var err = new Rate("err");
var h = { "Content-Type": "application/json" };

export var options = {
	scenarios: {
		flat: {
			executor: "constant-arrival-rate",
			rate: RATE,
			timeUnit: "1s",
			duration: DUR,
			preAllocatedVUs: 200,
			maxVUs: 1500,
			exec: MODE,
		},
	},
	summaryTrendStats: ["min", "med", "avg", "p(95)", "p(99)", "max"],
};

export function async() {
	var t = Date.now();
	var r = http.post(
		`${BASE}/api/workflows/start-async`,
		JSON.stringify({ workflowName: WORKFLOW, input: { t: t } }),
		{ headers: h },
	);
	lat.add(Date.now() - t);
	var success = check(r, { 200: (x) => x.status === 200 });
	if (success) ok.add(1);
	err.add(!success);
}

export function single() {
	var t = Date.now();
	var r = http.post(
		`${BASE}/api/workflows/start`,
		JSON.stringify({ workflowName: WORKFLOW, input: { t: t } }),
		{ headers: h },
	);
	lat.add(Date.now() - t);
	var success = check(r, { 200: (x) => x.status === 200 });
	if (success) ok.add(1);
	err.add(!success);
}

export function handleSummary(data) {
	var c = data.metrics.ok.values.count;
	var e = data.metrics.err.values.rate;
	var m = data.metrics.lat.values;
	var dur = data.state.testRunDurationMs / 1000;
	return {
		stdout:
			"\n=== " +
			MODE.toUpperCase() +
			" rate=" +
			RATE +
			"/s dur=" +
			DUR +
			" ===\n" +
			"  Workflows OK:    " +
			c +
			" (" +
			(c / dur).toFixed(0) +
			" wf/s over " +
			dur.toFixed(1) +
			"s)\n" +
			"  Error rate:      " +
			(e * 100).toFixed(2) +
			"%\n" +
			"  Latency p50:     " +
			Math.round(m.med) +
			"ms\n" +
			"  Latency p95:     " +
			Math.round(m["p(95)"]) +
			"ms\n" +
			"  Latency p99:     " +
			Math.round(m["p(99)"]) +
			"ms\n" +
			"  Latency max:     " +
			Math.round(m.max) +
			"ms\n",
	};
}
