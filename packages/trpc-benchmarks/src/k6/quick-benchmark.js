// Quick k6 benchmark for rapid comparison testing
// Run: k6 run src/k6/quick-benchmark.js --env BASE_URL=http://localhost:3001
// Quick run: k6 run --vus 10 --duration 10s src/k6/quick-benchmark.js

import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const pingLatency = new Trend("ping_latency", true);
const queryLatency = new Trend("query_latency", true);
const mutationLatency = new Trend("mutation_latency", true);
const errorRate = new Rate("error_rate");
const throughput = new Counter("total_requests");

// Configuration
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const TRPC_URL = `${BASE_URL}/trpc`;

export const options = {
	vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
	duration: __ENV.DURATION || "30s",
	thresholds: {
		http_req_duration: ["p(95)<200"],
		error_rate: ["rate<0.01"],
	},
};

// Wrap input in superjson format
function wrapInput(input) {
	return { json: input };
}

function trpcQuery(procedure, input = undefined) {
	const url = input
		? `${TRPC_URL}/${procedure}?input=${encodeURIComponent(JSON.stringify(wrapInput(input)))}`
		: `${TRPC_URL}/${procedure}`;
	return http.get(url, { headers: { "Content-Type": "application/json" } });
}

function trpcMutation(procedure, input) {
	return http.post(
		`${TRPC_URL}/${procedure}`,
		JSON.stringify(wrapInput(input)),
		{
			headers: { "Content-Type": "application/json" },
		},
	);
}

export default function () {
	// Ping (minimal overhead)
	const pingRes = trpcQuery("ping");
	throughput.add(1);
	pingLatency.add(pingRes.timings.duration);
	check(pingRes, { "ping ok": (r) => r.status === 200 });
	errorRate.add(pingRes.status !== 200);

	// Query with input
	const userRes = trpcQuery("user.get", { id: "user-1" });
	throughput.add(1);
	queryLatency.add(userRes.timings.duration);
	check(userRes, { "user.get ok": (r) => r.status === 200 });
	errorRate.add(userRes.status !== 200);

	// Mutation
	const createRes = trpcMutation("user.create", {
		name: `Test ${Date.now()}`,
		email: `test-${Date.now()}@example.com`,
	});
	throughput.add(1);
	mutationLatency.add(createRes.timings.duration);
	check(createRes, { "user.create ok": (r) => r.status === 200 });
	errorRate.add(createRes.status !== 200);

	// List query
	const listRes = trpcQuery("items.list", { page: 1, pageSize: 20 });
	throughput.add(1);
	queryLatency.add(listRes.timings.duration);
	check(listRes, { "items.list ok": (r) => r.status === 200 });
	errorRate.add(listRes.status !== 200);

	sleep(0.1);
}

export function setup() {
	const res = http.get(`${BASE_URL}/health`);
	if (res.status !== 200) {
		throw new Error(`Server not available at ${BASE_URL}`);
	}
	const info = JSON.parse(res.body);
	console.log(`Testing: ${info.runtime} + ${info.framework}`);
	return info;
}

export function teardown(data) {
	console.log(`Completed benchmark for: ${data.runtime} + ${data.framework}`);
}
