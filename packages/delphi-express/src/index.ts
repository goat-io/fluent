// @goatlab/delphi-express — drop-in Express adapter for the Goat agent engine.
//
// Mirrors the better-auth adapter pattern: a router factory that delegates
// every workflow endpoint to a user-supplied `resolveAgents(req)` callback.
// Framework-agnostic at the core (just calls into createWorkflowHandlers());
// the Express specifics are limited to req.body parsing and error mapping.
//
// Usage:
//   import { agentsRouter } from '@goatlab/delphi-express'
//   app.use('/api/workflows', agentsRouter({
//     resolveAgents: async (req) => {
//       const { engine, ingestBuffer } = await myFactory(req)
//       return { engine, ingestBuffer, tenantId: req.user.tenantId }
//     },
//   }))

import {
	createWorkflowHandlers,
	type IngestBuffer,
	type WorkflowEngine,
} from "@goatlab/delphi-core";
import {
	type NextFunction,
	type Request,
	type Response,
	Router,
} from "express";

export interface AgentsBundle {
	engine: WorkflowEngine;
	/**
	 * Optional — required only when /start-async is enabled. Skip if you
	 * don't want the queue-first ingest path.
	 */
	ingestBuffer?: IngestBuffer;
	tenantId: string;
}

export type AgentsResolver = (
	req: Request,
) => Promise<AgentsBundle> | AgentsBundle;

export interface AgentsRouterConfig {
	/**
	 * Per-request resolver. Called for every workflow endpoint. Your factory
	 * is responsible for caching engines per tenant — this resolver should
	 * be cheap (a Map lookup).
	 */
	resolveAgents: AgentsResolver;

	/**
	 * Optional: turn individual routes off. By default, every route is mounted.
	 * Set a key to `false` to skip mounting it (useful if your app exposes a
	 * subset, e.g. only async start + status, no batch).
	 */
	routes?: {
		start?: boolean; // POST /start         — sync start
		startAsync?: boolean; // POST /start-async   — queue-first start
		startBatch?: boolean; // POST /start-batch
		startBatchCopy?: boolean; // POST /start-batch-copy
		status?: boolean; // POST /status
		cancel?: boolean; // POST /cancel
		cancelAll?: boolean; // POST /cancel-all
		retry?: boolean; // POST /retry
		retryAll?: boolean; // POST /retry-all
		humanInput?: boolean; // POST /human-input
		signal?: boolean; // POST /signal
		query?: boolean; // POST /query
		stepLogs?: boolean; // POST /step-logs
		ingestEvent?: boolean; // POST /ingest-event
		listWorkflows?: boolean; // GET  /
		health?: boolean; // GET  /health
	};

	/**
	 * Optional: error mapper. Called when a handler throws. Returns the
	 * HTTP status to send. Default maps WORKFLOW_RUN_NOT_FOUND→404,
	 * IDEMPOTENCY_CONFLICT→409, everything else→500.
	 */
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

/**
 * Build an Express Router that exposes the workflow engine over HTTP.
 *
 * The router does not assume anything about your auth, tenant resolution,
 * or middleware ordering — it just delegates to your `resolveAgents()`
 * callback per request. Wire your auth / tenant middleware *before*
 * mounting this router.
 */
export function agentsRouter(config: AgentsRouterConfig): Router {
	const r = Router();
	const enabled = (
		k: keyof NonNullable<AgentsRouterConfig["routes"]>,
	): boolean => config.routes?.[k] ?? true;
	const mapError = config.mapError ?? defaultErrorMap;

	// Helper: wraps an async handler with the resolveAgents call + error mapping
	const wrap =
		(
			fn: (
				bundle: AgentsBundle,
				req: Request,
				res: Response,
			) => Promise<unknown>,
		) =>
		async (req: Request, res: Response, _next: NextFunction) => {
			try {
				const bundle = await config.resolveAgents(req);
				const result = await fn(bundle, req, res);
				if (!res.headersSent) res.json(result);
			} catch (err) {
				const { status, body } = mapError(err);
				if (!res.headersSent) res.status(status).json(body);
			}
		};

	if (enabled("startAsync")) {
		r.post(
			"/start-async",
			wrap(async ({ engine, ingestBuffer, tenantId }, req) => {
				if (!ingestBuffer) {
					throw new Error(
						"start-async requires resolveAgents to return an ingestBuffer",
					);
				}
				const trigger = { ...(req.body ?? {}), tenantId };
				// Durability dispatch: committed workflows block until PG COMMIT,
				// buffered workflows return as soon as the trigger hits memory.
				const def = engine
					.getWorkflows()
					.get((trigger as { workflowName?: string }).workflowName ?? "");
				if (def?.durability === "committed") {
					const { runId, traceId } =
						await ingestBuffer.enqueueCommitted(trigger);
					return { runId, traceId, status: "COMMITTED" };
				}
				const { runId, traceId } = ingestBuffer.enqueue(trigger);
				return { runId, traceId, status: "QUEUED" };
			}),
		);
	}

	if (enabled("start")) {
		r.post(
			"/start",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.start({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("startBatch")) {
		r.post(
			"/start-batch",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				const workflows = (
					(req.body?.workflows ?? []) as Array<Record<string, unknown>>
				).map((w) => ({ ...w, tenantId }));
				return handlers.startBatch({ workflows: workflows as any });
			}),
		);
	}

	if (enabled("startBatchCopy")) {
		r.post(
			"/start-batch-copy",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				const workflows = (
					(req.body?.workflows ?? []) as Array<Record<string, unknown>>
				).map((w) => ({ ...w, tenantId }));
				return handlers.startBatchCopy({ workflows: workflows as any });
			}),
		);
	}

	if (enabled("status")) {
		r.post(
			"/status",
			wrap(async ({ engine, ingestBuffer, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				try {
					return await handlers.getStatus({ ...(req.body ?? {}), tenantId });
				} catch (err) {
					const e = err as { code?: string };
					const runId = (req.body as { runId?: string } | undefined)?.runId;
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
								return {
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
								};
							}
						}
					}
					throw err;
				}
			}),
		);
	}

	if (enabled("cancel")) {
		r.post(
			"/cancel",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.cancel({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("cancelAll")) {
		r.post(
			"/cancel-all",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.cancelAll({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("retry")) {
		r.post(
			"/retry",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.retry({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("retryAll")) {
		r.post(
			"/retry-all",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.retryAll({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("stepLogs")) {
		r.post(
			"/step-logs",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.getStepLogs({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("humanInput")) {
		r.post(
			"/human-input",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.submitHumanInput({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("signal")) {
		r.post(
			"/signal",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.signal({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("query")) {
		r.post(
			"/query",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.query({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("ingestEvent")) {
		r.post(
			"/ingest-event",
			wrap(async ({ engine, tenantId }, req) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.ingestEvent({ ...(req.body ?? {}), tenantId });
			}),
		);
	}

	if (enabled("listWorkflows")) {
		r.get(
			"/",
			wrap(async ({ engine, tenantId }) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.listWorkflows({ tenantId });
			}),
		);
	}

	if (enabled("health")) {
		r.get("/health", async (_req, res) => {
			// Health is best-effort: we don't call resolveAgents because that
			// would require a tenant. Just confirms the router is mounted.
			res.json({ ok: true });
		});
	}

	return r;
}
