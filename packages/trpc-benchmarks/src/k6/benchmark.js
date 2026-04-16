// k6 benchmark script for tRPC API performance testing
// Run: k6 run src/k6/benchmark.js --env BASE_URL=http://localhost:3001
// Or with options: k6 run --vus 10 --duration 30s src/k6/benchmark.js

import {
	randomIntBetween,
	randomString,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { check, group, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const pingLatency = new Trend("trpc_ping_latency", true);
const healthLatency = new Trend("trpc_health_latency", true);
const userGetLatency = new Trend("trpc_user_get_latency", true);
const userCreateLatency = new Trend("trpc_user_create_latency", true);
const itemsListLatency = new Trend("trpc_items_list_latency", true);
const computeLatency = new Trend("trpc_compute_latency", true);
const errorRate = new Rate("trpc_error_rate");
const requestCount = new Counter("trpc_requests");

// Configuration
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const TRPC_URL = `${BASE_URL}/trpc`;

// k6 options - can be overridden via CLI
export const options = {
	scenarios: {
		// Smoke test - quick validation
		smoke: {
			executor: "constant-vus",
			vus: 1,
			duration: "10s",
			tags: { scenario: "smoke" },
			exec: "smokeTest",
		},
		// Load test - sustained load
		load: {
			executor: "ramping-vus",
			startVUs: 0,
			stages: [
				{ duration: "10s", target: 10 }, // Ramp up
				{ duration: "30s", target: 10 }, // Stay at 10 VUs
				{ duration: "10s", target: 20 }, // Ramp up more
				{ duration: "30s", target: 20 }, // Stay at 20 VUs
				{ duration: "10s", target: 0 }, // Ramp down
			],
			tags: { scenario: "load" },
			exec: "loadTest",
			startTime: "15s", // Start after smoke test
		},
		// Stress test - find breaking point
		stress: {
			executor: "ramping-vus",
			startVUs: 0,
			stages: [
				{ duration: "10s", target: 50 },
				{ duration: "20s", target: 50 },
				{ duration: "10s", target: 100 },
				{ duration: "20s", target: 100 },
				{ duration: "10s", target: 0 },
			],
			tags: { scenario: "stress" },
			exec: "stressTest",
			startTime: "120s", // Start after load test
		},
	},
	thresholds: {
		http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% < 500ms, 99% < 1s
		trpc_ping_latency: ["p(95)<50"], // Ping should be very fast
		trpc_error_rate: ["rate<0.01"], // Less than 1% errors
		http_req_failed: ["rate<0.01"],
	},
};

// Wrap input in superjson format (required by tRPC with superjson transformer)
function wrapInput(input) {
	return { json: input };
}

// Helper to make tRPC query calls
function trpcQuery(procedure, input = undefined) {
	const url = input
		? `${TRPC_URL}/${procedure}?input=${encodeURIComponent(JSON.stringify(wrapInput(input)))}`
		: `${TRPC_URL}/${procedure}`;

	return http.get(url, {
		headers: { "Content-Type": "application/json" },
	});
}

// Helper to make tRPC mutation calls
function trpcMutation(procedure, input) {
	return http.post(
		`${TRPC_URL}/${procedure}`,
		JSON.stringify(wrapInput(input)),
		{
			headers: { "Content-Type": "application/json" },
		},
	);
}

// Smoke test - basic functionality validation
export function smokeTest() {
	group("Smoke Test", () => {
		// Test ping endpoint
		const pingRes = trpcQuery("ping");
		requestCount.add(1);
		pingLatency.add(pingRes.timings.duration);
		check(pingRes, {
			"ping status is 200": (r) => r.status === 200,
			"ping returns pong": (r) => {
				try {
					const data = JSON.parse(r.body);
					return data.result?.data === "pong";
				} catch {
					return false;
				}
			},
		});
		errorRate.add(pingRes.status !== 200);

		sleep(0.1);

		// Test health endpoint
		const healthRes = trpcQuery("health");
		requestCount.add(1);
		healthLatency.add(healthRes.timings.duration);
		check(healthRes, {
			"health status is 200": (r) => r.status === 200,
			"health returns ok": (r) => {
				try {
					const data = JSON.parse(r.body);
					return data.result?.data?.status === "ok";
				} catch {
					return false;
				}
			},
		});
		errorRate.add(healthRes.status !== 200);

		sleep(0.1);

		// Test info endpoint
		const infoRes = trpcQuery("info");
		requestCount.add(1);
		check(infoRes, {
			"info status is 200": (r) => r.status === 200,
			"info has runtime": (r) => {
				try {
					const data = JSON.parse(r.body);
					return ["node", "bun"].includes(data.result?.data?.runtime);
				} catch {
					return false;
				}
			},
		});
		errorRate.add(infoRes.status !== 200);
	});

	sleep(1);
}

// Load test - sustained normal load
export function loadTest() {
	group("Load Test", () => {
		// Mix of different endpoint types

		// 1. Simple queries (high frequency)
		for (let i = 0; i < 5; i++) {
			const res = trpcQuery("ping");
			requestCount.add(1);
			pingLatency.add(res.timings.duration);
			errorRate.add(res.status !== 200);
			sleep(0.05);
		}

		// 2. User queries
		const userId = `user-${randomIntBetween(0, 99)}`;
		const userRes = trpcQuery("user.get", { id: userId });
		requestCount.add(1);
		userGetLatency.add(userRes.timings.duration);
		check(userRes, {
			"user.get status is 200": (r) => r.status === 200,
		});
		errorRate.add(userRes.status !== 200);
		sleep(0.1);

		// 3. Create user (mutation)
		const createRes = trpcMutation("user.create", {
			name: `LoadTest User ${randomString(8)}`,
			email: `loadtest-${randomString(8)}@example.com`,
		});
		requestCount.add(1);
		userCreateLatency.add(createRes.timings.duration);
		check(createRes, {
			"user.create status is 200": (r) => r.status === 200,
		});
		errorRate.add(createRes.status !== 200);
		sleep(0.1);

		// 4. Items list with pagination
		const page = randomIntBetween(1, 5);
		const itemsRes = trpcQuery("items.list", { page, pageSize: 20 });
		requestCount.add(1);
		itemsListLatency.add(itemsRes.timings.duration);
		check(itemsRes, {
			"items.list status is 200": (r) => r.status === 200,
			"items.list has items": (r) => {
				try {
					const data = JSON.parse(r.body);
					return Array.isArray(data.result?.data?.items);
				} catch {
					return false;
				}
			},
		});
		errorRate.add(itemsRes.status !== 200);
		sleep(0.1);

		// 5. Light computation
		const computeRes = trpcQuery("compute.hash", { iterations: 100 });
		requestCount.add(1);
		computeLatency.add(computeRes.timings.duration);
		check(computeRes, {
			"compute.hash status is 200": (r) => r.status === 200,
		});
		errorRate.add(computeRes.status !== 200);
	});

	sleep(0.5);
}

// Stress test - high load to find limits
export function stressTest() {
	group("Stress Test", () => {
		// Rapid fire pings
		for (let i = 0; i < 10; i++) {
			const res = trpcQuery("ping");
			requestCount.add(1);
			pingLatency.add(res.timings.duration);
			errorRate.add(res.status !== 200);
		}

		// Batch user lookups
		const ids = Array.from(
			{ length: 10 },
			(_, _i) => `user-${randomIntBetween(0, 99)}`,
		);
		const batchRes = trpcQuery("user.batch", { ids });
		requestCount.add(1);
		check(batchRes, {
			"user.batch status is 200": (r) => r.status === 200,
		});
		errorRate.add(batchRes.status !== 200);

		// Large data request
		const allItemsRes = trpcQuery("items.all");
		requestCount.add(1);
		check(allItemsRes, {
			"items.all status is 200": (r) => r.status === 200,
		});
		errorRate.add(allItemsRes.status !== 200);

		// CPU-intensive computation
		const fibRes = trpcQuery("compute.fibonacci", { n: 20 });
		requestCount.add(1);
		check(fibRes, {
			"compute.fibonacci status is 200": (r) => r.status === 200,
		});
		errorRate.add(fibRes.status !== 200);
	});

	sleep(0.2);
}

// Default function - runs all scenarios
export default function () {
	smokeTest();
	sleep(1);
	loadTest();
	sleep(1);
	stressTest();
}

// Setup function - runs once at the beginning
export function setup() {
	console.log(`Starting benchmark against ${BASE_URL}`);

	// Verify server is running
	const healthRes = http.get(`${BASE_URL}/health`);
	if (healthRes.status !== 200) {
		throw new Error(`Server not responding at ${BASE_URL}`);
	}

	const healthData = JSON.parse(healthRes.body);
	console.log(`Server info: ${JSON.stringify(healthData)}`);

	return { serverInfo: healthData };
}

// Teardown function - runs once at the end
export function teardown(data) {
	console.log(
		`Benchmark complete. Server was: ${JSON.stringify(data.serverInfo)}`,
	);
}
