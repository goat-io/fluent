/**
 * BullMQ Benchmark Script
 *
 * Run with: npx tsx src/benchmark.ts [mode]
 *
 * Modes:
 *   (default) - Run full benchmark without persistence
 *   persist   - Compare no-persist vs AOF persistence
 *
 * Uses testcontainers to spin up Redis automatically.
 */

import type { TaskConnector } from "@goatlab/tasks-core";
import { ShouldQueue } from "@goatlab/tasks-core";
import type { StartedRedisContainer } from "@testcontainers/redis";
import { RedisContainer } from "@testcontainers/redis";
import { GenericContainer } from "testcontainers";
import { BullMQConnector } from "./BullMQConnector.js";

// Configuration - keep benchmarks short
const QUEUE_BATCH_SIZE = 500;
const WARMUP_COUNT = 50;
const BENCHMARK_DURATION_MS = 5000; // 5 seconds
const E2E_TASK_COUNT = 1000;
const LATENCY_SAMPLES = 50;

class BenchmarkTask extends ShouldQueue<{ index: number }> {
	postUrl = "http://localhost/benchmark";
	taskName: string;

	constructor(connector: TaskConnector<{ index: number }>, name: string) {
		super({ connector });
		this.taskName = name;
	}

	async handle(): Promise<undefined> {
		return undefined;
	}
}

async function runQueueBenchmark(
	_connector: BullMQConnector,
	task: BenchmarkTask,
) {
	console.log("\n📊 Queue Throughput (queue-only, no worker)");
	console.log("=".repeat(50));

	// Warmup
	for (let i = 0; i < WARMUP_COUNT; i++) {
		await task.queue({ index: i });
	}

	console.log(`Running for ${BENCHMARK_DURATION_MS / 1000}s...`);
	let count = 0;
	const startTime = Date.now();
	const endTime = startTime + BENCHMARK_DURATION_MS;

	while (Date.now() < endTime) {
		const promises = [];
		for (let i = 0; i < QUEUE_BATCH_SIZE; i++) {
			promises.push(task.queue({ index: count++ }));
		}
		await Promise.all(promises);
	}

	const elapsed = Date.now() - startTime;
	const throughput = (count / elapsed) * 1000;

	console.log(`✅ Queued: ${count.toLocaleString()} tasks`);
	console.log(`✅ Throughput: ${throughput.toFixed(0)} tasks/sec`);

	return throughput;
}

async function runE2EBenchmark(
	connector: BullMQConnector,
	task: BenchmarkTask,
) {
	console.log("\n📊 End-to-End (queue + worker)");
	console.log("=".repeat(50));

	await connector.startWorker({
		tasks: [task],
		workerName: "benchmark-worker",
		concurrency: 50,
	});
	await new Promise((r) => setTimeout(r, 500));

	console.log(`Queuing ${E2E_TASK_COUNT} tasks...`);
	const start = Date.now();

	// Queue all tasks in parallel batches
	for (let i = 0; i < E2E_TASK_COUNT; i += QUEUE_BATCH_SIZE) {
		const batch = [];
		for (let j = 0; j < QUEUE_BATCH_SIZE && i + j < E2E_TASK_COUNT; j++) {
			batch.push(task.queue({ index: i + j }));
		}
		await Promise.all(batch);
	}

	const queueTime = Date.now() - start;

	// Wait for completion (max 15s)
	const timeout = 15000;
	let completed = 0;
	const waitStart = Date.now();

	while (completed < E2E_TASK_COUNT && Date.now() - waitStart < timeout) {
		const counts = await connector.getJobCounts(task.taskName);
		completed = counts.completed || 0;
		if (completed < E2E_TASK_COUNT) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	const totalTime = Date.now() - start;
	const throughput = (completed / totalTime) * 1000;

	console.log(`✅ Processed: ${completed.toLocaleString()} tasks`);
	console.log(`✅ Queue time: ${queueTime}ms`);
	console.log(`✅ Total time: ${totalTime}ms`);
	console.log(`✅ Throughput: ${throughput.toFixed(0)} tasks/sec`);

	return throughput;
}

async function runLatencyBenchmark(
	connector: BullMQConnector,
	task: BenchmarkTask,
) {
	console.log("\n📊 Latency (round-trip)");
	console.log("=".repeat(50));

	await connector.startWorker({
		tasks: [task],
		workerName: "latency-worker",
		concurrency: 10,
	});
	await new Promise((r) => setTimeout(r, 500));

	const latencies: number[] = [];

	for (let i = 0; i < LATENCY_SAMPLES; i++) {
		const start = Date.now();
		const status = await task.queue({ index: i });

		// Poll for completion (max 2s per task)
		const timeout = Date.now() + 2000;
		while (Date.now() < timeout) {
			const currentStatus = await task.getStatus(status.id);
			if (
				currentStatus.status === "COMPLETED" ||
				currentStatus.status === "FAILED"
			) {
				latencies.push(Date.now() - start);
				break;
			}
			await new Promise((r) => setTimeout(r, 5));
		}
	}

	latencies.sort((a, b) => a - b);
	const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
	const p50 = latencies[Math.floor(latencies.length * 0.5)];
	const p95 = latencies[Math.floor(latencies.length * 0.95)];
	const p99 = latencies[Math.floor(latencies.length * 0.99)];

	console.log(`✅ Samples: ${latencies.length}`);
	console.log(
		`✅ Avg: ${avg.toFixed(1)}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`,
	);

	return { avg, p50, p95, p99 };
}

async function main() {
	console.log("🚀 BullMQ Benchmark");
	console.log("Starting Redis container...");

	let redisContainer: StartedRedisContainer | null = null;

	try {
		redisContainer = await new RedisContainer("redis:7-alpine").start();
		const host = redisContainer.getHost();
		const port = redisContainer.getMappedPort(6379);
		console.log(`Redis: ${host}:${port}`);

		// Queue throughput test (separate queue)
		const connector1 = new BullMQConnector({ connection: { host, port } });
		const task1 = new BenchmarkTask(connector1, "bench_queue");
		const queueThroughput = await runQueueBenchmark(connector1, task1);
		await connector1.close();

		// E2E test (separate queue)
		const connector2 = new BullMQConnector({ connection: { host, port } });
		const task2 = new BenchmarkTask(connector2, "bench_e2e");
		const e2eThroughput = await runE2EBenchmark(connector2, task2);
		await connector2.close();

		// Latency test (separate queue)
		const connector3 = new BullMQConnector({ connection: { host, port } });
		const task3 = new BenchmarkTask(connector3, "bench_latency");
		const latency = await runLatencyBenchmark(connector3, task3);
		await connector3.close();

		// Summary
		console.log(`\n${"=".repeat(50)}`);
		console.log("📈 BULLMQ SUMMARY");
		console.log("=".repeat(50));
		console.log(`Queue throughput:  ${queueThroughput.toFixed(0)} tasks/sec`);
		console.log(`E2E throughput:    ${e2eThroughput.toFixed(0)} tasks/sec`);
		console.log(`Latency (avg):     ${latency.avg.toFixed(1)}ms`);
		console.log(`Latency (p95):     ${latency.p95}ms`);
	} finally {
		if (redisContainer) {
			console.log("\nStopping Redis container...");
			await redisContainer.stop();
		}
	}
}

async function runPersistenceComparison() {
	console.log("🚀 BullMQ Persistence Comparison");
	console.log("=".repeat(50));

	const results: { mode: string; throughput: number }[] = [];

	// Test 1: No persistence (default)
	console.log("\n📊 Mode: NO PERSISTENCE (default)");
	const container1 = await new RedisContainer("redis:7-alpine").start();
	const connector1 = new BullMQConnector({
		connection: {
			host: container1.getHost(),
			port: container1.getMappedPort(6379),
		},
	});
	const task1 = new BenchmarkTask(connector1, "bench_nopersist");

	for (let i = 0; i < WARMUP_COUNT; i++) await task1.queue({ index: i });

	let count = 0;
	const start1 = Date.now();
	const end1 = start1 + BENCHMARK_DURATION_MS;
	while (Date.now() < end1) {
		const batch = [];
		for (let i = 0; i < QUEUE_BATCH_SIZE; i++)
			batch.push(task1.queue({ index: count++ }));
		await Promise.all(batch);
	}
	const throughput1 = Math.round((count / (Date.now() - start1)) * 1000);
	console.log(`✅ Throughput: ${throughput1.toLocaleString()} tasks/sec`);
	results.push({ mode: "No persistence", throughput: throughput1 });
	await connector1.close();
	await container1.stop();

	// Test 2: AOF with appendfsync everysec (balanced)
	console.log("\n📊 Mode: AOF (appendfsync everysec)");
	const container2 = await new GenericContainer("redis:7-alpine")
		.withCommand([
			"redis-server",
			"--appendonly",
			"yes",
			"--appendfsync",
			"everysec",
		])
		.withExposedPorts(6379)
		.start();
	const connector2 = new BullMQConnector({
		connection: {
			host: container2.getHost(),
			port: container2.getMappedPort(6379),
		},
	});
	const task2 = new BenchmarkTask(connector2, "bench_aof_sec");

	for (let i = 0; i < WARMUP_COUNT; i++) await task2.queue({ index: i });

	count = 0;
	const start2 = Date.now();
	const end2 = start2 + BENCHMARK_DURATION_MS;
	while (Date.now() < end2) {
		const batch = [];
		for (let i = 0; i < QUEUE_BATCH_SIZE; i++)
			batch.push(task2.queue({ index: count++ }));
		await Promise.all(batch);
	}
	const throughput2 = Math.round((count / (Date.now() - start2)) * 1000);
	console.log(`✅ Throughput: ${throughput2.toLocaleString()} tasks/sec`);
	results.push({ mode: "AOF everysec", throughput: throughput2 });
	await connector2.close();
	await container2.stop();

	// Test 3: AOF with appendfsync always (safest, slowest)
	console.log("\n📊 Mode: AOF (appendfsync always) - SAFEST");
	const container3 = await new GenericContainer("redis:7-alpine")
		.withCommand([
			"redis-server",
			"--appendonly",
			"yes",
			"--appendfsync",
			"always",
		])
		.withExposedPorts(6379)
		.start();
	const connector3 = new BullMQConnector({
		connection: {
			host: container3.getHost(),
			port: container3.getMappedPort(6379),
		},
	});
	const task3 = new BenchmarkTask(connector3, "bench_aof_always");

	for (let i = 0; i < WARMUP_COUNT; i++) await task3.queue({ index: i });

	count = 0;
	const start3 = Date.now();
	const end3 = start3 + BENCHMARK_DURATION_MS;
	while (Date.now() < end3) {
		const batch = [];
		for (let i = 0; i < QUEUE_BATCH_SIZE; i++)
			batch.push(task3.queue({ index: count++ }));
		await Promise.all(batch);
	}
	const throughput3 = Math.round((count / (Date.now() - start3)) * 1000);
	console.log(`✅ Throughput: ${throughput3.toLocaleString()} tasks/sec`);
	results.push({ mode: "AOF always", throughput: throughput3 });
	await connector3.close();
	await container3.stop();

	// Summary
	console.log(`\n${"=".repeat(50)}`);
	console.log("📈 PERSISTENCE COMPARISON");
	console.log("=".repeat(50));
	for (const r of results) {
		const pct = Math.round((r.throughput / results[0].throughput) * 100);
		console.log(
			`${r.mode.padEnd(20)} ${r.throughput.toLocaleString().padStart(10)} tasks/sec  (${pct}%)`,
		);
	}
}

async function runPayloadComparison() {
	console.log("🚀 BullMQ Payload Size Comparison");
	console.log("=".repeat(50));

	const container = await new RedisContainer("redis:7-alpine").start();
	const host = container.getHost();
	const port = container.getMappedPort(6379);
	console.log(`Redis: ${host}:${port}`);

	const results: { size: string; bytes: number; throughput: number }[] = [];

	// Different payload sizes
	const payloads = [
		{ name: "Tiny (100B)", data: { id: 1, msg: "x".repeat(80) } },
		{
			name: "Small (1KB)",
			data: { id: 1, msg: "x".repeat(900), extra: "y".repeat(100) },
		},
		{ name: "Medium (10KB)", data: { id: 1, data: "x".repeat(10000) } },
		{ name: "Large (100KB)", data: { id: 1, data: "x".repeat(100000) } },
		{ name: "XL (500KB)", data: { id: 1, data: "x".repeat(500000) } },
	];

	for (const payload of payloads) {
		const bytes = JSON.stringify(payload.data).length;
		console.log(`\n📊 Payload: ${payload.name} (~${bytes} bytes)`);

		const connector = new BullMQConnector({ connection: { host, port } });
		const queueName = `bench_${payload.name.replace(/[^a-z]/gi, "")}`;

		// Queue directly using addJob to pass custom payload
		const queue = (connector as any).getQueue(queueName);

		// Warmup
		for (let i = 0; i < 20; i++) {
			await queue.add("job", payload.data);
		}

		// Benchmark
		let count = 0;
		const start = Date.now();
		const end = start + BENCHMARK_DURATION_MS;
		while (Date.now() < end) {
			const batch = [];
			for (let i = 0; i < QUEUE_BATCH_SIZE; i++) {
				batch.push(queue.add("job", payload.data));
				count++;
			}
			await Promise.all(batch);
		}

		const throughput = Math.round((count / (Date.now() - start)) * 1000);
		console.log(`✅ Throughput: ${throughput.toLocaleString()} tasks/sec`);
		results.push({ size: payload.name, bytes, throughput });

		await connector.close();
	}

	await container.stop();

	// Summary
	console.log(`\n${"=".repeat(50)}`);
	console.log("📈 PAYLOAD SIZE COMPARISON");
	console.log("=".repeat(50));
	const maxThroughput = results[0].throughput;
	for (const r of results) {
		const pct = Math.round((r.throughput / maxThroughput) * 100);
		const mbps = ((r.bytes * r.throughput) / 1024 / 1024).toFixed(1);
		console.log(
			`${r.size.padEnd(18)} ${r.throughput.toLocaleString().padStart(10)} tasks/sec  (${pct.toString().padStart(3)}%)  ${mbps.padStart(6)} MB/s`,
		);
	}
}

if (process.argv[2] === "persist") {
	runPersistenceComparison().catch(console.error);
} else if (process.argv[2] === "payload") {
	runPayloadComparison().catch(console.error);
} else {
	main().catch(console.error);
}
