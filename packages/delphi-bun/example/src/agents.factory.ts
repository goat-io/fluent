// Agent engine factory — single-tenant for example simplicity. Same as
// the Express example except this one is loaded by Bun directly (no tsx).

import {
	type Database as AgentsDB,
	createEngine,
	EventIngestionService,
	FunctionStep,
	IngestWorker,
	type JsonObject,
	type StepPayload,
	step,
	type TypedEngine,
	Workflow,
	WorkflowStepTask,
} from "@goatlab/delphi-core";
import { BullMQConnector } from "@goatlab/tasks-adapter-bullmq";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

const TENANT_ID = process.env.TENANT_ID ?? "demo-tenant";
const POOL_SIZE = parseInt(process.env.PG_POOL_SIZE ?? "20", 10);
const WORKER_CONC = parseInt(process.env.WORKER_CONCURRENCY ?? "50", 10);

// ── Step + Workflow classes (typed, no string handler refs) ──

class EchoStep extends FunctionStep<
	JsonObject,
	{ echoed: boolean; step: string; ts: number },
	"echo"
> {
	stepName = "echo" as const;
	async handle() {
		return { output: { echoed: true, step: this.stepName, ts: Date.now() } };
	}
}
class ChainAStep extends FunctionStep<
	JsonObject,
	{ chained: boolean; at: "a"; ts: number },
	"a"
> {
	stepName = "a" as const;
	async handle() {
		return { output: { chained: true, at: "a" as const, ts: Date.now() } };
	}
}
class ChainBStep extends FunctionStep<
	{ from: unknown },
	{ chained: boolean; at: "b"; ts: number },
	"b"
> {
	stepName = "b" as const;
	async handle() {
		return { output: { chained: true, at: "b" as const, ts: Date.now() } };
	}
}
class ChainCStep extends FunctionStep<
	{ from: unknown },
	{ chained: boolean; at: "c"; ts: number },
	"c"
> {
	stepName = "c" as const;
	async handle() {
		return { output: { chained: true, at: "c" as const, ts: Date.now() } };
	}
}

const echoStep = new EchoStep();
const chainA = new ChainAStep();
const chainB = new ChainBStep();
const chainC = new ChainCStep();

class FastSingleWorkflow extends Workflow<JsonObject> {
	workflowName = "fast_single" as const;
	override defaultRetries = 0;
	steps = [step(echoStep)] as const;
}

class FastChainWorkflow extends Workflow<JsonObject> {
	workflowName = "fast_chain" as const;
	override defaultRetries = 0;
	steps = [
		step(chainA),
		step(chainB, { dependsOn: [chainA], mapInput: (up) => ({ from: up.a }) }),
		step(chainC, { dependsOn: [chainB], mapInput: (up) => ({ from: up.b }) }),
	] as const;
}

type AgentsEngine = TypedEngine<
	readonly [FastSingleWorkflow, FastChainWorkflow]
>;

let cached: Promise<{
	engine: AgentsEngine;
	pool: pg.Pool;
	connector: BullMQConnector;
}> | null = null;

export async function getAgents() {
	if (cached) return cached;
	cached = (async () => {
		if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env required");

		const pool = new pg.Pool({
			connectionString: process.env.DATABASE_URL,
			max: POOL_SIZE,
			idleTimeoutMillis: 30_000,
		});
		const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) });

		const connector = new BullMQConnector({
			connection: {
				host: process.env.REDIS_HOST ?? "localhost",
				port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
				maxRetriesPerRequest: null,
			},
			tenantId: TENANT_ID,
		});

		const engine = createEngine({
			workflows: [new FastSingleWorkflow(), new FastChainWorkflow()] as const,
			db,
			pgPool: pool,
			connector,
			tenantId: TENANT_ID,
			schema: "agents",
			eventIngestion: new EventIngestionService({ db }),
			ingest: {
				flushThreshold: 200,
				flushIntervalMs: 50,
				maxJitterMs: 20,
			},
		});

		const ingestWorker = new IngestWorker({
			engine,
			flushThreshold: 200,
			flushIntervalMs: 20,
			maxConcurrentFlushes: 8,
		});

		const stepTask = new WorkflowStepTask(engine);
		stepTask.setConnector(connector);

		await connector.listen({
			tasks: [
				{
					taskName: "workflow_ingest",
					handle: (d: unknown) => ingestWorker.handleJob(d as any),
					concurrency: 300,
				},
				{
					taskName: "workflow_step_light",
					handle: (d: unknown) => stepTask.handle(d as StepPayload),
					concurrency: WORKER_CONC,
				},
				{
					taskName: "workflow_step_heavy",
					handle: (d: unknown) => stepTask.handle(d as StepPayload),
					concurrency: Math.max(5, WORKER_CONC / 4),
				},
				{
					taskName: "workflow_step_ai",
					handle: (d: unknown) => stepTask.handle(d as StepPayload),
					concurrency: Math.max(10, WORKER_CONC / 2),
				},
				{
					taskName: "workflow_step_sandbox",
					handle: (d: unknown) => stepTask.handle(d as StepPayload),
					concurrency: 5,
				},
			],
		});

		return { engine, pool, connector };
	})();
	return cached;
}

export async function shutdownAgents() {
	if (!cached) return;
	const { engine, pool, connector } = await cached;
	await engine.ingestBuffer.shutdown();
	await engine.shutdown();
	await connector.close();
	await pool.end();
	cached = null;
}
