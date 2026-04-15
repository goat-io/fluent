// @goatlab/delphi-trpc — drop-in tRPC adapter for the agent engine.
//
// Build a router with all the engine endpoints as tRPC procedures, plug it
// into your existing root router under any name (e.g. `workflows`).
//
// Why a factory + injected `procedure` instead of a fixed router export:
// every tRPC app has its own auth middleware, error formatter, context type,
// and procedure variants. We can't ship a router that bakes those in. The
// caller passes their authed `procedure` and we hang our handlers off it,
// keeping their auth/middleware story intact.
//
// Usage:
//   import { createAgentsTrpcRouter } from '@goatlab/delphi-trpc'
//
//   const workflowsRouter = createAgentsTrpcRouter({
//     t,                                     // your initTRPC instance
//     procedure: t.procedure.use(authMid),   // YOUR authed procedure
//     resolveAgents: async ({ ctx }) => {
//       const { engine, ingestBuffer } = await myFactory(ctx.tenantId)
//       return { engine, ingestBuffer, tenantId: ctx.tenantId }
//     },
//   })
//
//   export const appRouter = t.router({
//     workflows: workflowsRouter,
//     // ... your other routers
//   })

import {
	createWorkflowHandlers,
	type IngestBuffer,
	type WorkflowEngine,
} from "@goatlab/delphi-core";
import {
	cancelInputSchema,
	humanInputSchema,
	ingestEventInputSchema,
	queryInputSchema,
	signalInputSchema,
	startAsyncInputSchema,
	startAsyncOutputSchema,
	startBatchInputSchema,
	startInputSchema,
	statusInputSchema,
} from "./schemas.js";

export interface AgentsBundle {
	engine: WorkflowEngine;
	/** Required for startAsync; optional otherwise. */
	ingestBuffer?: IngestBuffer;
	tenantId: string;
}

/**
 * `procedure` is the user's authed procedure (e.g. `t.procedure.use(authMid)`).
 * `resolveAgents` is the per-call factory bridge — receives tRPC's opts
 * ({ ctx, input, ... }) and returns the per-tenant engine bundle.
 */
export interface AgentsTrpcRouterConfig<TProcedure, TInput = unknown> {
	/** Your `initTRPC.create()` instance — used to build the router. */
	// biome-ignore lint/suspicious/noExplicitAny: tRPC's t type is heavy, intentionally generic
	t: { router: (defs: any) => any };
	/** Your authed procedure builder — handlers chain off this. */
	procedure: TProcedure;
	/** Resolve per-call: usually reads ctx.tenantId, returns engine + buffer. */
	resolveAgents: (opts: {
		ctx: TInput;
	}) => Promise<AgentsBundle> | AgentsBundle;
	/**
	 * Optional: per-procedure enable flags. Default: all on.
	 * Set a key to `false` to omit it from the router.
	 */
	procedures?: {
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
		list?: boolean;
		health?: boolean;
	};
}

/**
 * Build a tRPC router exposing every engine endpoint as a procedure.
 * Returns a plain tRPC router — callable from your client via
 * `client.workflows.startAsync.mutate({...})`.
 */
// biome-ignore lint/suspicious/noExplicitAny: tRPC procedure types are opaque generics
export function createAgentsTrpcRouter<
	TProcedure extends { input: any; query: any; mutation: any },
>(config: AgentsTrpcRouterConfig<TProcedure>) {
	const { t, procedure, resolveAgents } = config;
	const enabled = (k: keyof NonNullable<typeof config.procedures>) =>
		config.procedures?.[k] ?? true;

	// Helper — get the bundle for the call, then run a fn with it
	// biome-ignore lint/suspicious/noExplicitAny: opaque tRPC opts type
	const withBundle = async (
		opts: any,
		fn: (b: AgentsBundle) => Promise<unknown>,
	) => {
		const bundle = await resolveAgents({ ctx: opts.ctx });
		return fn(bundle);
	};

	// Use any-typed builder calls — tRPC procedures are heavily generic and
	// resist parameterization across versions. The runtime contract is solid;
	// the types are too quirky to nail perfectly across v10/v11.
	// biome-ignore lint/suspicious/noExplicitAny: tRPC builder API
	const p = procedure as any;
	const procs: Record<string, unknown> = {};

	if (enabled("startAsync")) {
		procs.startAsync = p
			.input(startAsyncInputSchema)
			.output(startAsyncOutputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ ingestBuffer, tenantId }) => {
					if (!ingestBuffer)
						throw new Error(
							"startAsync requires resolveAgents to return ingestBuffer",
						);
					const { runId, traceId } = ingestBuffer.enqueue({
						...input,
						tenantId,
					});
					return Promise.resolve({ runId, traceId, status: "QUEUED" as const });
				}),
			);
	}

	if (enabled("start")) {
		procs.start = p
			.input(startInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.start({ ...input, tenantId });
				}),
			);
	}

	if (enabled("startBatch")) {
		procs.startBatch = p
			.input(startBatchInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.startBatch({
						// biome-ignore lint/suspicious/noExplicitAny: zod-inferred record
						workflows: input.workflows.map((w: any) => ({ ...w, tenantId })),
					});
				}),
			);
	}

	if (enabled("startBatchCopy")) {
		procs.startBatchCopy = p
			.input(startBatchInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.startBatchCopy({
						// biome-ignore lint/suspicious/noExplicitAny: zod-inferred record
						workflows: input.workflows.map((w: any) => ({ ...w, tenantId })),
					});
				}),
			);
	}

	if (enabled("status")) {
		procs.status = p
			.input(statusInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.query(({ input, ctx }: any) =>
				withBundle({ ctx }, async ({ engine, ingestBuffer, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					try {
						return await handlers.getStatus({ ...input, tenantId });
					} catch (err) {
						// QUEUED-fallback: in-flight runs not yet COPY'd to PG
						// biome-ignore lint/suspicious/noExplicitAny: error code shape
						const e = err as any;
						if (
							e?.code === "WORKFLOW_RUN_NOT_FOUND" &&
							input.runId &&
							ingestBuffer
						) {
							// biome-ignore lint/suspicious/noExplicitAny: connector method
							const queue = (engine as any).config?.connector?.getQueue?.(
								"workflow_ingest",
							);
							if (queue?.getJob) {
								const job = await queue.getJob(`ingest-${input.runId}`);
								if (job) {
									const state = await job.getState();
									const data = job.data ?? {};
									return {
										id: input.runId,
										// biome-ignore lint/suspicious/noExplicitAny: opaque BullMQ job data
										traceId: (data as any).trigger?.traceId ?? null,
										// biome-ignore lint/suspicious/noExplicitAny: opaque BullMQ job data
										workflowName: (data as any).trigger?.workflowName ?? null,
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
		procs.cancel = p
			.input(cancelInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.cancel({ ...input, tenantId });
				}),
			);
	}

	if (enabled("humanInput")) {
		procs.humanInput = p
			.input(humanInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.submitHumanInput({ ...input, tenantId });
				}),
			);
	}

	if (enabled("signal")) {
		procs.signal = p
			.input(signalInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.signal({ ...input, tenantId });
				}),
			);
	}

	if (enabled("query")) {
		procs.query = p
			.input(queryInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.query(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.query({ ...input, tenantId });
				}),
			);
	}

	if (enabled("ingestEvent")) {
		procs.ingestEvent = p
			.input(ingestEventInputSchema)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
			.mutation(({ input, ctx }: any) =>
				withBundle({ ctx }, ({ engine, tenantId }) => {
					const handlers = createWorkflowHandlers(engine);
					return handlers.ingestEvent({ ...input, tenantId });
				}),
			);
	}

	if (enabled("list")) {
		// biome-ignore lint/suspicious/noExplicitAny: tRPC opts
		procs.list = p.query(({ ctx }: any) =>
			withBundle({ ctx }, ({ engine, tenantId }) => {
				const handlers = createWorkflowHandlers(engine);
				return handlers.listWorkflows({ tenantId });
			}),
		);
	}

	if (enabled("health")) {
		procs.health = p.query(() => Promise.resolve({ ok: true }));
	}

	return t.router(procs);
}

export {
	cancelInputSchema,
	humanInputSchema,
	ingestEventInputSchema,
	queryInputSchema,
	signalInputSchema,
	startAsyncInputSchema,
	startAsyncOutputSchema,
	startBatchInputSchema,
	startInputSchema,
	statusInputSchema,
} from "./schemas.js";
