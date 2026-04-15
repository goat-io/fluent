// k6 script for horizontal-scaling test — distributes load across N
// example instances on different ports.
//
// Each VU picks a random port per iteration, simulating an LB doing
// round-robin / random across N pods.

import { check } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

var INSTANCES = parseInt(__ENV.INSTANCES || "4", 10);
var BASE_PORT = parseInt(__ENV.BASE_PORT || "3000", 10);
var RATE = parseInt(__ENV.RATE || "5000", 10);
var DUR = __ENV.DUR || "30s";

var lat = new Trend("lat", true);
var ok = new Counter("ok");
var err = new Rate("err");
var perInstance = new Counter("per_instance_hits");

var headers = { "Content-Type": "application/json" };

export var options = {
	scenarios: {
		horizontal: {
			executor: "constant-arrival-rate",
			rate: RATE,
			timeUnit: "1s",
			duration: DUR,
			preAllocatedVUs: 200,
			maxVUs: 1500,
			exec: "fire",
		},
	},
	summaryTrendStats: ["min", "med", "avg", "p(95)", "p(99)", "max"],
};

export function fire() {
	// Pick a random port — simulates LB distribution across N instances
	var port = BASE_PORT + Math.floor(Math.random() * INSTANCES);
	var url = `http://localhost:${port}/api/workflows/start-async`;
	var t = Date.now();
	var r = http.post(
		url,
		JSON.stringify({ workflowName: "fast_single", input: { t: t } }),
		{ headers: headers, tags: { instance: String(port) } },
	);
	lat.add(Date.now() - t);
	perInstance.add(1, { instance: String(port) });
	var success = check(r, { 200: (x) => x.status === 200 });
	if (success) ok.add(1);
	err.add(!success);
}

export function handleSummary(data) {
	var c = data.metrics.ok.values.count;
	var e = data.metrics.err.values.rate;
	var m = data.metrics.lat.values;
	var dur = data.state.testRunDurationMs / 1000;

	// Per-instance hit distribution from sub-metric
	var distribution = "";
	// k6 doesn't easily expose tagged sub-metric values in handleSummary;
	// print a simple note instead
	for (let i = 0; i < INSTANCES; i++) {
		distribution += `    instance ${BASE_PORT + i}: hits split via VU randomness\n`;
	}

	return {
		stdout:
			"\n=== HORIZONTAL rate=" +
			RATE +
			"/s instances=" +
			INSTANCES +
			" dur=" +
			DUR +
			" ===\n" +
			"  Workflows OK:    " +
			c +
			" (" +
			(c / dur).toFixed(0) +
			" wf/s)\n" +
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
			"ms\n" +
			"  Distribution:\n" +
			distribution,
	};
}
