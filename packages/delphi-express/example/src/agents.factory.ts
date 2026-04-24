// Agent engine factory — single-tenant for example simplicity.
//
// In a real multi-tenant app, replace the singleton with an LRU+TTL cache
// keyed by tenantId (mirror your better-auth.factory.ts shape).

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
import { RedisRealtimeBroker } from "@goatlab/realtime-broker";
import { BullMQConnector } from "@goatlab/tasks-adapter-bullmq";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

const TENANT_ID = process.env.TENANT_ID ?? "demo-tenant";
const POOL_SIZE = parseInt(process.env.PG_POOL_SIZE ?? "20", 10);
const WORKER_CONC = parseInt(process.env.WORKER_CONCURRENCY ?? "50", 10);

// ── Step classes (the work — typed inputs/outputs, no string handler refs) ──

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
	{ from: JsonObject },
	{ chained: boolean; at: "b"; ts: number },
	"b"
> {
	stepName = "b" as const;
	async handle() {
		return { output: { chained: true, at: "b" as const, ts: Date.now() } };
	}
}
class ChainCStep extends FunctionStep<
	{ from: JsonObject },
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

// ── Workflow classes (DAGs over step instances) ───────────────────

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
	broker: InstanceType<typeof RedisRealtimeBroker>;
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

		// Realtime broker — same Redis as BullMQ (separate connection due to
		// pub/sub mode). Per-tenant subscriber pooling: 1 conn per tenant
		// regardless of how many SSE clients connect.
		const broker = new RedisRealtimeBroker({
			redis: {
				host: process.env.REDIS_HOST ?? "localhost",
				port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
				maxRetriesPerRequest: null,
			},
		});

		// createEngine wires up FunctionStepExecutor + IngestBuffer internally
		// and auto-registers each step class's handle() method. The returned
		// engine has typed `.fast_single` / `.fast_chain` properties.
		const engine = createEngine({
			workflows: [new FastSingleWorkflow(), new FastChainWorkflow()] as const,
			db,
			pgPool: pool,
			connector,
			tenantId: TENANT_ID,
			schema: "agents", // engine tables live in the `agents` PG schema
			eventIngestion: new EventIngestionService({ db }),
			// Engine event hook → broker: SSE subscribers see live workflow updates.
			// Fires AFTER each PG state-transition write commits — subscribers can
			// immediately query PG and see the new state.
			onEngineEvent: (evt) => {
				broker
					.publish(evt.tenantId, `engine:run:${evt.runId}`, evt)
					.catch(() => {});
				broker.publish(evt.tenantId, `engine:tenant`, evt).catch(() => {});
			},
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
				// Ingest concurrency must be ≥ ingestWorker.flushThreshold so batches
				// can fill (BullMQ caps in-flight handlers at concurrency).
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

		return { engine, pool, connector, broker };
	})();
	return cached;
}

export async function shutdownAgents() {
	if (!cached) return;
	const { engine, pool, connector, broker } = await cached;
	await engine.ingestBuffer.shutdown();
	await engine.shutdown();
	await broker.close();
	await connector.close();
	await pool.end();
	cached = null;
}
