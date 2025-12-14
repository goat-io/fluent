import { Ids, Memo } from "@goatlab/js-utils";
import type {
	ShouldQueue,
	TaskConnector,
	TaskStatus,
	TaskStatusName,
} from "@goatlab/tasks-core";
import type { ConnectionOptions, JobsOptions } from "bullmq";
import { type Job, Queue, Worker } from "bullmq";

// Default configuration constants
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 6379;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CONCURRENCY = 100;

export interface BullMQConnectionOptions {
	host?: string;
	port?: number;
	password?: string;
	db?: number;
	family?: 4 | 6;
	maxRetriesPerRequest?: number | null;
}

export interface BullMQConnectorConfig {
	connection?: BullMQConnectionOptions;
	defaultJobOptions?: JobsOptions;
}

/**
 * Maps BullMQ job states to TaskStatusName
 */
const mapJobStateToStatus = (state: string | undefined): TaskStatusName => {
	switch (state) {
		case "completed":
			return "COMPLETED";
		case "failed":
			return "FAILED";
		case "active":
			return "RUNNING";
		case "waiting":
		case "delayed":
		case "prioritized":
		case "waiting-children":
			return "QUEUED";
		default:
			return "QUEUED";
	}
};

export class BullMQConnector implements TaskConnector<object> {
	private readonly connectionOptions: ConnectionOptions;
	private readonly defaultJobOptions: JobsOptions;
	private readonly queues: Map<string, Queue> = new Map();
	private readonly workers: Map<string, Worker> = new Map();

	constructor(config?: BullMQConnectorConfig) {
		this.connectionOptions = {
			host: config?.connection?.host || DEFAULT_HOST,
			port: config?.connection?.port || DEFAULT_PORT,
			password: config?.connection?.password,
			db: config?.connection?.db || 0,
			family: config?.connection?.family || 4,
			maxRetriesPerRequest: config?.connection?.maxRetriesPerRequest ?? null,
		};

		this.defaultJobOptions = config?.defaultJobOptions || {
			attempts: DEFAULT_MAX_RETRIES,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
			removeOnComplete: false,
			removeOnFail: false,
		};
	}

	/**
	 * Gets or creates a queue for a given queue name.
	 * Queues are memoized to avoid creating multiple instances.
	 */
	@Memo.syncMethod()
	public getQueue(queueName: string): Queue {
		const existing = this.queues.get(queueName);
		if (existing) {
			return existing;
		}

		const queue = new Queue(queueName, {
			connection: this.connectionOptions,
			defaultJobOptions: this.defaultJobOptions,
		});

		this.queues.set(queueName, queue);
		return queue;
	}

	/**
	 * Creates a worker for processing jobs from a BullMQ task.
	 * Similar to Hatchet's getHatchetTask but creates a worker.
	 */
	public getBullMQWorker(
		task: ShouldQueue,
		concurrency = DEFAULT_CONCURRENCY,
	): Worker {
		const worker = new Worker(
			task.taskName,
			async (job: Job) => {
				return task.handle(job.data);
			},
			{
				connection: this.connectionOptions,
				concurrency,
			},
		);

		return worker;
	}

	/**
	 * Starts a worker to process jobs for the given tasks.
	 * Similar pattern to HatchetConnector.startWorker().
	 */
	async startWorker({
		workerName,
		tasks,
		concurrency = DEFAULT_CONCURRENCY,
	}: {
		workerName?: string;
		tasks: ShouldQueue[];
		concurrency?: number;
	}): Promise<Worker[]> {
		const workers: Worker[] = [];

		for (const task of tasks) {
			const worker = new Worker(
				task.taskName,
				async (job: Job) => {
					return task.handle(job.data);
				},
				{
					connection: this.connectionOptions,
					concurrency,
					name: `${workerName || task.taskName}-${Ids.nanoId(5)}`,
				},
			);

			this.workers.set(task.taskName, worker);
			workers.push(worker);
		}

		// Give workers some time to start and connect to Redis
		await new Promise((resolve) => setTimeout(resolve, 1000));

		return workers;
	}

	/**
	 * Stops all workers and closes all queue connections.
	 */
	async close(): Promise<void> {
		const closePromises: Promise<void>[] = [];

		for (const worker of this.workers.values()) {
			closePromises.push(worker.close());
		}

		for (const queue of this.queues.values()) {
			closePromises.push(queue.close());
		}

		await Promise.all(closePromises);
		this.workers.clear();
		this.queues.clear();
	}

	/**
	 * Gets the status of a job by its ID.
	 * Implements the TaskConnector interface.
	 * @param id - Job ID (in format: queueName:jobId or just jobId if queueName is known)
	 */
	async getStatus(id: string): Promise<TaskStatus> {
		// Parse the id which may be in format "queueName:jobId"
		const [queueName, jobId] = id.includes(":")
			? id.split(":")
			: [this.getDefaultQueueName(), id];

		const queue = this.getQueue(queueName);
		const job = await queue.getJob(jobId);

		if (!job) {
			// Job not found - could be completed and removed
			return {
				id,
				name: queueName,
				status: "COMPLETED",
				output: "",
				attempts: 0,
				created: new Date().toISOString(),
				nextRun: null,
				nextRunMinutes: null,
				payload: {},
			};
		}

		const state = await job.getState();
		const status = mapJobStateToStatus(state);

		return {
			id,
			name: job.name,
			status,
			output: job.returnvalue ? JSON.stringify(job.returnvalue) : "",
			attempts: job.attemptsMade,
			created: new Date(job.timestamp).toISOString(),
			nextRun: job.processedOn ? new Date(job.processedOn).toISOString() : null,
			nextRunMinutes: null,
			payload: job.data || {},
		};
	}

	/**
	 * Gets the default queue name.
	 * Used when no queue name is specified.
	 */
	private getDefaultQueueName(): string {
		return "default";
	}

	/**
	 * Queues a task to be run in the background.
	 * Implements the TaskConnector interface.
	 * @param params
	 * @param params.uniqueTaskName - Unique name for this task instance
	 * @param params.taskName - Name of the task/queue
	 * @param params.postUrl - URL to post the task to (not used in BullMQ, kept for interface compatibility)
	 * @param params.taskBody - Body/data of the task
	 * @param params.handle - Handler function for the task
	 */
	async queue(params: {
		uniqueTaskName: string;
		taskName: string;
		postUrl: string;
		taskBody: object;
		handle: () => Promise<any>;
	}): Promise<Omit<TaskStatus, "payload">> {
		const queue = this.getQueue(params.taskName);

		// Create a unique job ID using the uniqueTaskName and a nanoId
		const jobId = `${params.uniqueTaskName}_${Ids.nanoId(5)}`;

		const job = await queue.add(params.taskName, params.taskBody, {
			jobId,
			...this.defaultJobOptions,
		});

		const now = new Date().toISOString();

		return {
			id: `${params.taskName}:${job.id}`,
			name: params.taskName,
			output: "",
			attempts: 0,
			status: "QUEUED",
			created: now,
			nextRun: null,
			nextRunMinutes: null,
		};
	}

	/**
	 * Adds a job to a queue with custom options.
	 * This is a convenience method for more advanced usage.
	 */
	async addJob<T extends object>(
		queueName: string,
		jobName: string,
		data: T,
		options?: JobsOptions,
	): Promise<Job<T>> {
		const queue = this.getQueue(queueName);
		return queue.add(jobName, data, {
			...this.defaultJobOptions,
			...options,
		});
	}

	/**
	 * Gets a job by its ID from a specific queue.
	 */
	async getJob<T = any>(
		queueName: string,
		jobId: string,
	): Promise<Job<T> | undefined> {
		const queue = this.getQueue(queueName);
		return queue.getJob(jobId);
	}

	/**
	 * Removes a job by its ID from a specific queue.
	 */
	async removeJob(queueName: string, jobId: string): Promise<void> {
		const queue = this.getQueue(queueName);
		const job = await queue.getJob(jobId);
		if (job) {
			await job.remove();
		}
	}

	/**
	 * Pauses a queue.
	 */
	async pauseQueue(queueName: string): Promise<void> {
		const queue = this.getQueue(queueName);
		await queue.pause();
	}

	/**
	 * Resumes a paused queue.
	 */
	async resumeQueue(queueName: string): Promise<void> {
		const queue = this.getQueue(queueName);
		await queue.resume();
	}

	/**
	 * Gets the count of jobs in different states for a queue.
	 */
	async getJobCounts(queueName: string): Promise<{
		waiting: number;
		active: number;
		completed: number;
		failed: number;
		delayed: number;
	}> {
		const queue = this.getQueue(queueName);
		const counts = await queue.getJobCounts(
			"waiting",
			"active",
			"completed",
			"failed",
			"delayed",
		);
		return {
			waiting: counts.waiting ?? 0,
			active: counts.active ?? 0,
			completed: counts.completed ?? 0,
			failed: counts.failed ?? 0,
			delayed: counts.delayed ?? 0,
		};
	}

	/**
	 * Lists failed jobs in a queue.
	 */
	async listFailedJobs(
		queueName: string,
		start = 0,
		end = 100,
	): Promise<Job[]> {
		const queue = this.getQueue(queueName);
		return queue.getFailed(start, end);
	}

	/**
	 * Retries a failed job.
	 */
	async retryJob(queueName: string, jobId: string): Promise<void> {
		const queue = this.getQueue(queueName);
		const job = await queue.getJob(jobId);
		if (job) {
			await job.retry();
		}
	}

	/**
	 * Obliterates a queue - removes all jobs and data.
	 * Use with caution!
	 */
	async obliterateQueue(queueName: string): Promise<void> {
		const queue = this.getQueue(queueName);
		await queue.obliterate();
		this.queues.delete(queueName);
	}
}
