// npx vitest run src/__tests__/router.spec.ts

import { createServer, type Server } from "node:http";
import express, { type Express } from "express";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	type AgentsBundle,
	type AgentsRouterConfig,
	agentsRouter,
} from "../index";

// ─── Mocks ──────────────────────────────────────────────────────────────────

/**
 * We mock `@goatlab/delphi-core` so tests don't need Postgres/BullMQ.
 * `createWorkflowHandlers` is the only import the router uses from the core.
 */
vi.mock("@goatlab/delphi-core", () => ({
	createWorkflowHandlers: vi.fn(),
}));

import { createWorkflowHandlers } from "@goatlab/delphi-core";

const mockCreateHandlers = vi.mocked(createWorkflowHandlers);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal fake engine with spied methods */
function fakeEngine() {
	const workflows = new Map<string, any>();
	workflows.set("order-flow", {
		name: "order-flow",
		version: "1",
		durability: "buffered",
		steps: [],
	});
	workflows.set("payment-flow", {
		name: "payment-flow",
		version: "1",
		durability: "committed",
		steps: [],
	});

	return {
		start: vi.fn().mockResolvedValue({ runId: "run-1" }),
		getStatus: vi.fn().mockResolvedValue({
			id: "run-1",
			workflowName: "order-flow",
			workflowVersion: "1",
			status: "COMPLETED",
			triggerInput: {},
			output: { result: true },
			error: null,
			startedAt: new Date(),
			completedAt: new Date(),
			createdAt: new Date(),
			steps: [],
		}),
		getWorkflows: vi.fn().mockReturnValue(workflows),
		startBatch: vi.fn().mockResolvedValue([{ runId: "run-batch-1" }]),
		startBatchCopy: vi.fn().mockResolvedValue([{ runId: "run-copy-1" }]),
		cancel: vi.fn().mockResolvedValue(undefined),
		signal: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue({ answer: 42 }),
		submitHumanInput: vi.fn().mockResolvedValue(undefined),
		listWorkflows: vi.fn().mockResolvedValue([]),
		heartbeat: vi.fn().mockResolvedValue(undefined),
	};
}

/** Minimal fake ingest buffer */
function fakeIngestBuffer() {
	return {
		enqueue: vi.fn().mockReturnValue({ runId: "buf-1", traceId: "tr-1" }),
		enqueueCommitted: vi
			.fn()
			.mockResolvedValue({ runId: "com-1", traceId: "tr-2" }),
	};
}

/** Build the handlers object that createWorkflowHandlers would return */
function fakeHandlers(engine: ReturnType<typeof fakeEngine>) {
	return {
		start: vi
			.fn()
			.mockImplementation(async (input: any) => engine.start(input)),
		getStatus: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.getStatus(input.runId, input.tenantId),
			),
		startBatch: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.startBatch(input.workflows),
			),
		startBatchCopy: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.startBatchCopy(input.workflows),
			),
		cancel: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.cancel(input.runId, input.tenantId),
			),
		signal: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.signal(
					input.runId,
					input.tenantId,
					input.signalName,
					input.data,
				),
			),
		query: vi
			.fn()
			.mockImplementation(async (input: any) =>
				engine.query(input.runId, input.tenantId, input.queryName),
			),
		submitHumanInput: vi
			.fn()
			.mockImplementation(async (input: any) => engine.submitHumanInput(input)),
		listWorkflows: vi
			.fn()
			.mockResolvedValue([{ name: "order-flow", version: "1", stepCount: 2 }]),
		ingestEvent: vi.fn().mockResolvedValue({ eventId: "evt-1" }),
	};
}

// ─── HTTP helper (supertest-free: just use node:http) ──────────────────────

async function request(
	app: Express,
	method: "GET" | "POST",
	path: string,
	body?: object,
): Promise<{ status: number; body: any }> {
	return new Promise((resolve, reject) => {
		const server: Server = createServer(app);
		server.listen(0, () => {
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				server.close();
				return reject(new Error("bad address"));
			}
			const options = {
				hostname: "127.0.0.1",
				port: addr.port,
				path,
				method,
				headers: { "Content-Type": "application/json" },
			};
			const req = require("node:http").request(options, (res: any) => {
				let data = "";
				res.on("data", (chunk: string) => {
					data += chunk;
				});
				res.on("end", () => {
					server.close();
					try {
						resolve({ status: res.statusCode, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode, body: data });
					}
				});
			});
			req.on("error", (err: Error) => {
				server.close();
				reject(err);
			});
			if (body) req.write(JSON.stringify(body));
			req.end();
		});
	});
}

function buildApp(config: AgentsRouterConfig): Express {
	const app = express();
	app.use(express.json());
	app.use("/api", agentsRouter(config));
	return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("agentsRouter", () => {
	let engine: ReturnType<typeof fakeEngine>;
	let handlers: ReturnType<typeof fakeHandlers>;
	let ingestBuffer: ReturnType<typeof fakeIngestBuffer>;
	let bundle: AgentsBundle;
	let app: Express;

	beforeEach(() => {
		vi.clearAllMocks();

		engine = fakeEngine();
		handlers = fakeHandlers(engine);
		ingestBuffer = fakeIngestBuffer();
		bundle = {
			engine: engine as any,
			ingestBuffer: ingestBuffer as any,
			tenantId: "tenant-1",
		};

		mockCreateHandlers.mockReturnValue(handlers as any);

		app = buildApp({
			resolveAgents: async () => bundle,
		});
	});

	// ── Health ──────────────────────────────────────────────────────────────

	describe("GET /health", () => {
		it("returns { ok: true }", async () => {
			const res = await request(app, "GET", "/api/health");
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ ok: true });
		});

		it("does not call resolveAgents", async () => {
			const resolver = vi.fn().mockResolvedValue(bundle);
			const customApp = buildApp({ resolveAgents: resolver });
			await request(customApp, "GET", "/api/health");
			expect(resolver).not.toHaveBeenCalled();
		});
	});

	// ── Start ─────────────────────────────────────────────────────────────

	describe("POST /start", () => {
		it("calls createWorkflowHandlers(engine).start() with body + tenantId", async () => {
			const body = { workflowName: "order-flow", input: { orderId: "123" } };
			const res = await request(app, "POST", "/api/start", body);

			expect(res.status).toBe(200);
			expect(mockCreateHandlers).toHaveBeenCalledWith(engine);
			expect(handlers.start).toHaveBeenCalledWith({
				workflowName: "order-flow",
				input: { orderId: "123" },
				tenantId: "tenant-1",
			});
		});

		it("returns the start result as JSON", async () => {
			const res = await request(app, "POST", "/api/start", {
				workflowName: "order-flow",
				input: {},
			});
			expect(res.body).toEqual({ runId: "run-1" });
		});
	});

	// ── Start Async ──────────────────────────────────────────────────────

	describe("POST /start-async", () => {
		it("uses ingestBuffer.enqueue for buffered workflows", async () => {
			const res = await request(app, "POST", "/api/start-async", {
				workflowName: "order-flow",
			});
			expect(res.status).toBe(200);
			expect(ingestBuffer.enqueue).toHaveBeenCalled();
			expect(res.body).toEqual({
				runId: "buf-1",
				traceId: "tr-1",
				status: "QUEUED",
			});
		});

		it("uses ingestBuffer.enqueueCommitted for committed workflows", async () => {
			const res = await request(app, "POST", "/api/start-async", {
				workflowName: "payment-flow",
			});
			expect(res.status).toBe(200);
			expect(ingestBuffer.enqueueCommitted).toHaveBeenCalled();
			expect(res.body).toEqual({
				runId: "com-1",
				traceId: "tr-2",
				status: "COMMITTED",
			});
		});

		it("returns 500 when ingestBuffer is missing", async () => {
			const noBufferBundle = { ...bundle, ingestBuffer: undefined };
			const noBufferApp = buildApp({
				resolveAgents: async () => noBufferBundle,
			});
			const res = await request(noBufferApp, "POST", "/api/start-async", {
				workflowName: "order-flow",
			});
			expect(res.status).toBe(500);
			expect(res.body.error).toMatch(/ingestBuffer/);
		});
	});

	// ── Status ────────────────────────────────────────────────────────────

	describe("POST /status", () => {
		it("calls getStatus with body + tenantId", async () => {
			const res = await request(app, "POST", "/api/status", { runId: "run-1" });
			expect(res.status).toBe(200);
			expect(handlers.getStatus).toHaveBeenCalledWith({
				runId: "run-1",
				tenantId: "tenant-1",
			});
		});

		it("returns the status response", async () => {
			const res = await request(app, "POST", "/api/status", { runId: "run-1" });
			expect(res.body.id).toBe("run-1");
			expect(res.body.workflowName).toBe("order-flow");
		});
	});

	// ── Route disabling ──────────────────────────────────────────────────

	describe("route disabling", () => {
		it("returns 404 when health is disabled", async () => {
			const disabledApp = buildApp({
				resolveAgents: async () => bundle,
				routes: { health: false },
			});
			const res = await request(disabledApp, "GET", "/api/health");
			expect(res.status).toBe(404);
		});

		it("returns 404 when start is disabled", async () => {
			const disabledApp = buildApp({
				resolveAgents: async () => bundle,
				routes: { start: false },
			});
			const res = await request(disabledApp, "POST", "/api/start", {
				workflowName: "order-flow",
				input: {},
			});
			expect(res.status).toBe(404);
		});

		it("other routes still work when one is disabled", async () => {
			const disabledApp = buildApp({
				resolveAgents: async () => bundle,
				routes: { health: false },
			});
			const res = await request(disabledApp, "POST", "/api/start", {
				workflowName: "order-flow",
				input: {},
			});
			expect(res.status).toBe(200);
		});
	});

	// ── Error mapping ────────────────────────────────────────────────────

	describe("error mapping", () => {
		it("maps WORKFLOW_RUN_NOT_FOUND to 404", async () => {
			handlers.getStatus.mockRejectedValueOnce(
				Object.assign(new Error("Run not found"), {
					code: "WORKFLOW_RUN_NOT_FOUND",
				}),
			);
			const res = await request(app, "POST", "/api/status", {
				runId: "missing",
			});
			expect(res.status).toBe(404);
			expect(res.body.code).toBe("WORKFLOW_RUN_NOT_FOUND");
		});

		it("maps IDEMPOTENCY_CONFLICT to 409", async () => {
			handlers.start.mockRejectedValueOnce(
				Object.assign(new Error("Duplicate"), { code: "IDEMPOTENCY_CONFLICT" }),
			);
			const res = await request(app, "POST", "/api/start", {
				workflowName: "order-flow",
				input: {},
			});
			expect(res.status).toBe(409);
			expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
		});

		it("maps unknown errors to 500", async () => {
			handlers.start.mockRejectedValueOnce(new Error("boom"));
			const res = await request(app, "POST", "/api/start", {
				workflowName: "x",
				input: {},
			});
			expect(res.status).toBe(500);
			expect(res.body.error).toBe("boom");
		});

		it("uses custom mapError when provided", async () => {
			const customApp = buildApp({
				resolveAgents: async () => bundle,
				mapError: () => ({ status: 503, body: { custom: true } }),
			});
			handlers.start.mockRejectedValueOnce(new Error("oops"));
			const res = await request(customApp, "POST", "/api/start", {
				workflowName: "x",
				input: {},
			});
			expect(res.status).toBe(503);
			expect(res.body).toEqual({ custom: true });
		});
	});

	// ── List workflows ───────────────────────────────────────────────────

	describe("GET /", () => {
		it("calls listWorkflows with tenantId", async () => {
			const res = await request(app, "GET", "/api/");
			expect(res.status).toBe(200);
			expect(handlers.listWorkflows).toHaveBeenCalledWith({
				tenantId: "tenant-1",
			});
		});
	});

	// ── Cancel ───────────────────────────────────────────────────────────

	describe("POST /cancel", () => {
		it("calls cancel handler with body + tenantId", async () => {
			const res = await request(app, "POST", "/api/cancel", { runId: "run-1" });
			expect(res.status).toBe(200);
			expect(handlers.cancel).toHaveBeenCalledWith({
				runId: "run-1",
				tenantId: "tenant-1",
			});
		});
	});

	// ── Signal ───────────────────────────────────────────────────────────

	describe("POST /signal", () => {
		it("calls signal handler with body + tenantId", async () => {
			const body = {
				runId: "run-1",
				signalName: "approve",
				data: { ok: true },
			};
			const res = await request(app, "POST", "/api/signal", body);
			expect(res.status).toBe(200);
			expect(handlers.signal).toHaveBeenCalledWith({
				...body,
				tenantId: "tenant-1",
			});
		});
	});

	// ── Query ────────────────────────────────────────────────────────────

	describe("POST /query", () => {
		it("calls query handler with body + tenantId", async () => {
			const body = { runId: "run-1", queryName: "info" };
			const res = await request(app, "POST", "/api/query", body);
			expect(res.status).toBe(200);
			expect(handlers.query).toHaveBeenCalledWith({
				...body,
				tenantId: "tenant-1",
			});
		});
	});

	// ── Human input ──────────────────────────────────────────────────────

	describe("POST /human-input", () => {
		it("calls submitHumanInput handler with body + tenantId", async () => {
			const body = {
				workflowRunId: "run-1",
				stepName: "approval",
				data: { approved: true },
			};
			const res = await request(app, "POST", "/api/human-input", body);
			expect(res.status).toBe(200);
			expect(handlers.submitHumanInput).toHaveBeenCalledWith({
				...body,
				tenantId: "tenant-1",
			});
		});
	});

	// ── Ingest event ─────────────────────────────────────────────────────

	describe("POST /ingest-event", () => {
		it("calls ingestEvent handler with body + tenantId", async () => {
			const body = {
				eventType: "order.created",
				source: "shopify",
				payload: { id: "ord-1" },
			};
			const res = await request(app, "POST", "/api/ingest-event", body);
			expect(res.status).toBe(200);
			expect(handlers.ingestEvent).toHaveBeenCalledWith({
				...body,
				tenantId: "tenant-1",
			});
		});
	});
});
