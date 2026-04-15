// @goatlab/delphi-bun — Bun.serve adapter for the Goat agent engine.
//
// Returns a single `fetch(req: Request) => Promise<Response>` handler that
// matches every workflow path and delegates to a user-supplied
// `resolveAgents(req)` callback. Plug into `Bun.serve({ fetch })` directly
// or under a path prefix via `Bun.serve({ routes: { '/api/workflows/*': handler } })`.
//
// Usage:
//   import { agentsBunHandler } from '@goatlab/delphi-bun'
//   const handler = agentsBunHandler({
//     resolveAgents: async (req) => ({ engine, ingestBuffer, tenantId }),
//   })
//   Bun.serve({ port: 3000, fetch: handler })

import {
	createWorkflowHandlers,
	type IngestBuffer,
	type WorkflowEngine,
} from "@goatlab/delphi-core";

export interface AgentsBundle {
	engine: WorkflowEngine;
	/** Required for /start-async; skip if you don't expose the queue-first path. */
	ingestBuffer?: IngestBuffer;
	tenantId: string;
}

export type AgentsResolver = (
	req: Request,
) => Promise<AgentsBundle> | AgentsBundle;

export interface AgentsBunHandlerConfig {
	/** Per-request resolver. Cache engines by tenant in your own factory. */
	resolveAgents: AgentsResolver;
	/**
	 * Optional path prefix to strip before matching. Default: empty (handler
	 * matches /start-async, /status, etc. directly). Set to '/api/workflows'
	 * if you mount the handler under a prefix in Bun.serve routes.
	 */
	prefix?: string;
	/** Optional: turn off specific routes. Default: all on. */
	routes?: {
		start?: boolean;
		startAsync?: boolean;
		startBatch?: boolean;
		startBatchCopy?: boolean;
		status?: boolean;
		cancel?: boolean;
		humanInput?: boolean;
		signal?: boolean;
		query?: boolean;
		ingestEvent?: boolean;
		listWorkflows?: boolean;
		health?: boolean;
	};
	/** Optional: error mapper. */
	mapError?: (err: unknown) => { status: number; body: object };
}

const defaultErrorMap = (err: unknown): { status: number; body: object } => {
	const e = err as { code?: string; message?: string };
	const code = e?.code;
	const message = e?.message ?? "Internal error";
	if (code === "WORKFLOW_RUN_NOT_FOUND")
		return { status: 404, body: { error: message, code } };
	if (code === "IDEMPOTENCY_CONFLICT")
		return { status: 409, body: { error: message, code } };
	return { status: 500, body: { error: message, code } };
};

const json = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

/**
 * Build a Bun-compatible fetch handler. Returns a function with the
 * `(req: Request) => Promise<Response>` shape that Bun.serve expects.
 */
export function agentsBunHandler(config: AgentsBunHandlerConfig) {
	const enabled = (
		k: keyof NonNullable<AgentsBunHandlerConfig["routes"]>,
	): boolean => config.routes?.[k] ?? true;
	const mapError = config.mapError ?? defaultErrorMap;
	const prefix = config.prefix ?? "";

	return async function handler(req: Request): Promise<Response> {
		const url = new URL(req.url);
		let path = url.pathname;
		if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length);
		if (!path.startsWith("/")) path = "/" + path;

		// Health is dirt-cheap and doesn't touch the engine
		if (req.method === "GET" && path === "/health" && enabled("health")) {
			return json(200, { ok: true });
		}

		if (req.method === "GET" && path === "/" && enabled("listWorkflows")) {
			try {
				const { engine, tenantId } = await config.resolveAgents(req);
				const handlers = createWorkflowHandlers(engine);
				return json(200, await handlers.listWorkflows({ tenantId }));
			} catch (err) {
				const { status, body } = mapError(err);
				return json(status, body);
			}
		}

		// Everything else is POST — parse body once
		if (req.method !== "POST")
			return json(405, { error: "Method not allowed" });

		let body: Record<string, unknown> = {};
		try {
			body = (await req.json()) as Record<string, unknown>;
		} catch {
			/* allow empty body */
		}

		try {
			const bundle = await config.resolveAgents(req);
			const { engine, ingestBuffer, tenantId } = bundle;

			if (path === "/start-async" && enabled("startAsync")) {
				if (!ingestBuffer)
					throw new Error(
						"start-async requires resolveAgents to return an ingestBuffer",
					);
				const { runId, traceId } = ingestBuffer.enqueue({
					...body,
					tenantId,
				} as any);
				return json(200, { runId, traceId, status: "QUEUED" });
			}

			const handlers = createWorkflowHandlers(engine);

			if (path === "/start" && enabled("start")) {
				return json(200, await handlers.start({ ...body, tenantId } as any));
			}
			if (path === "/start-batch" && enabled("startBatch")) {
				const workflows = (
					(body.workflows as Array<Record<string, unknown>> | undefined) ?? []
				).map((w) => ({ ...w, tenantId }));
				return json(
					200,
					await handlers.startBatch({ workflows: workflows as any }),
				);
			}
			if (path === "/start-batch-copy" && enabled("startBatchCopy")) {
				const workflows = (
					(body.workflows as Array<Record<string, unknown>> | undefined) ?? []
				).map((w) => ({ ...w, tenantId }));
				return json(
					200,
					await handlers.startBatchCopy({ workflows: workflows as any }),
				);
			}
			if (path === "/status" && enabled("status")) {
				try {
					return json(
						200,
						await handlers.getStatus({ ...body, tenantId } as any),
					);
				} catch (err) {
					const e = err as { code?: string };
					const runId = (body as { runId?: string }).runId;
					// Queue-first fallback: when PG misses, the run might still be in BullMQ
					if (e?.code === "WORKFLOW_RUN_NOT_FOUND" && runId && ingestBuffer) {
						const queue = (engine as any).config?.connector?.getQueue?.(
							"workflow_ingest",
						);
						if (queue?.getJob) {
							const job = await queue.getJob(`ingest-${runId}`);
							if (job) {
								const state = await job.getState();
								const data = job.data ?? {};
								return json(200, {
									id: runId,
									traceId:
										(data as { trigger?: { traceId?: string } }).trigger
											?.traceId ?? null,
									workflowName:
										(data as { trigger?: { workflowName?: string } }).trigger
											?.workflowName ?? null,
									status: state === "failed" ? "INGEST_FAILED" : "QUEUED",
									ingestState: state,
									steps: [],
									createdAt: new Date(job.timestamp).toISOString(),
								});
							}
						}
					}
					throw err;
				}
			}
			if (path === "/cancel" && enabled("cancel")) {
				return json(200, await handlers.cancel({ ...body, tenantId } as any));
			}
			if (path === "/human-input" && enabled("humanInput")) {
				return json(
					200,
					await handlers.submitHumanInput({ ...body, tenantId } as any),
				);
			}
			if (path === "/signal" && enabled("signal")) {
				return json(200, await handlers.signal({ ...body, tenantId } as any));
			}
			if (path === "/query" && enabled("query")) {
				return json(200, await handlers.query({ ...body, tenantId } as any));
			}
			if (path === "/ingest-event" && enabled("ingestEvent")) {
				return json(
					200,
					await handlers.ingestEvent({ ...body, tenantId } as any),
				);
			}

			return json(404, { error: "Not found", path });
		} catch (err) {
			const { status, body } = mapError(err);
			return json(status, body);
		}
	};
}
