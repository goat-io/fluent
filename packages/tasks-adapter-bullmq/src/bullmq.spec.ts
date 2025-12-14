// npx vitest run ./src/bullmq.spec.ts

import type { ShouldQueue } from "@goatlab/tasks-core";
import { taskConnectorTestSuite } from "@goatlab/tasks-core/test-suite";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { BullMQConnector } from "./BullMQConnector.js";
import { getGlobalData } from "./test/const.js";

// Create connector instance
const globalData = getGlobalData();
const bullmqConnector = new BullMQConnector({
	connection: {
		host: globalData.host || "localhost",
		port: globalData.port || 6379,
	},
});

// Run the standardized test suite
taskConnectorTestSuite(
	{ describe, it, expect, beforeAll, afterAll, beforeEach, afterEach },
	() => bullmqConnector,
	{
		taskCompletionTimeout: 10000,
		statusCheckInterval: 500,
		runLifecycleTests: true,
		startWorker: async (tasks: ShouldQueue[]) => {
			// Start a worker for all the provided tasks
			await bullmqConnector.startWorker({
				workerName: "test-suite-worker",
				tasks,
				concurrency: 10,
			});
			return async () => {
				await bullmqConnector.close();
			};
		},
		cleanup: async () => {
			await bullmqConnector.close();
		},
	},
);

// Additional BullMQ-specific tests
describe("BullMQConnector Specific Tests", () => {
	let connector: BullMQConnector;

	beforeAll(async () => {
		connector = new BullMQConnector({
			connection: {
				host: globalData.host || "localhost",
				port: globalData.port || 6379,
			},
		});
	});

	afterAll(async () => {
		await connector.close();
	});

	it("should get job counts for a queue", async () => {
		const counts = await connector.getJobCounts("test_specific_queue");

		expect(counts).toHaveProperty("waiting");
		expect(counts).toHaveProperty("active");
		expect(counts).toHaveProperty("completed");
		expect(counts).toHaveProperty("failed");
		expect(counts).toHaveProperty("delayed");
	});

	it("should add a job directly to a queue", async () => {
		const job = await connector.addJob("direct_queue", "direct_job", {
			data: "test",
		});

		expect(job).toHaveProperty("id");
		expect(job).toHaveProperty("name", "direct_job");
		expect(job.data).toEqual({ data: "test" });
	});

	it("should get a job by id", async () => {
		const job = await connector.addJob("get_job_queue", "get_job_test", {
			value: 123,
		});

		const retrievedJob = await connector.getJob("get_job_queue", job.id!);

		expect(retrievedJob).toBeDefined();
		expect(retrievedJob?.data).toEqual({ value: 123 });
	});

	it("should remove a job", async () => {
		const job = await connector.addJob("remove_job_queue", "remove_job_test", {
			toRemove: true,
		});

		await connector.removeJob("remove_job_queue", job.id!);

		const removedJob = await connector.getJob("remove_job_queue", job.id!);
		expect(removedJob).toBeUndefined();
	});

	it("should pause and resume a queue", async () => {
		await connector.pauseQueue("pause_test_queue");
		// Queue should be paused

		await connector.resumeQueue("pause_test_queue");
		// Queue should be resumed
	});
});
