// Blank Express + Prisma app showing how to mount @goatlab/delphi-express.
//
// Run:
//   pnpm infra:up && pnpm db:generate && pnpm db:push && pnpm start
//   curl http://localhost:3000/health
//
// Then load test:
//   pnpm loadtest
//
// Cluster mode: set CLUSTER_MODE=auto (default — forks cores-1 workers),
// CLUSTER_MODE=N (N workers), or CLUSTER_MODE=off (single process).
// Cluster gives roughly Nx HTTP throughput per instance.

import cluster from "node:cluster";
import os from "node:os";
import { agentsRouter } from "@goatlab/delphi-express";
import express from "express";
import { getAgents, shutdownAgents } from "./agents.factory.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const TENANT_ID = process.env.TENANT_ID ?? "demo-tenant";

function desiredWorkers(): number {
	const mode = process.env.CLUSTER_MODE ?? "auto";
	const cores =
		(os as { availableParallelism?: () => number }).availableParallelism?.() ??
		os.cpus().length;
	if (mode === "off" || cores <= 1) return 1;
	if (mode === "auto") return Math.max(1, cores - 1);
	const n = parseInt(mode, 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

async function main() {
	// Boot the engine + workers up-front so the first request doesn't pay a
	// cold-start cost. In a multi-tenant app, you'd boot lazily per tenant.
	console.log("Booting engine...");
	await getAgents();
	console.log("  ✅ engine + workers ready");

	const app = express();
	app.use(express.json({ limit: "1mb" }));

	// Health is dirt-cheap and doesn't touch the engine — used by your LB.
	app.get("/health", (_req, res) => res.json({ ok: true }));

	// Mount every workflow endpoint under /api/workflows.
	// resolveAgents is the plug-in point: return { engine, ingestBuffer, tenantId }.
	// For a multi-tenant app, pull tenantId from your auth middleware.
	app.use(
		"/api/workflows",
		agentsRouter({
			resolveAgents: async (_req) => {
				const { engine } = await getAgents();
				return {
					engine,
					ingestBuffer: engine.ingestBuffer,
					tenantId: TENANT_ID,
				};
			},
		}),
	);

	// SSE endpoint — subscribes to engine events for a specific run. Demonstrates
	// the realtime broker integration: engine.onEngineEvent → broker.publish →
	// this subscriber → flushed to the SSE client. No polling needed; updates
	// arrive within milliseconds of the PG commit.
	//
	// Test with:
	//   curl -N http://localhost:3000/api/workflows/events/<runId>
	app.get("/api/workflows/events/:runId", async (req, res) => {
		const runId = req.params.runId;
		if (!runId) {
			res.status(400).end();
			return;
		}

		const { broker } = await getAgents();

		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.flushHeaders();
		res.write(`: subscribed to engine:run:${runId}\n\n`);

		const sub = await broker.subscribe(
			TENANT_ID,
			`engine:run:${runId}`,
			(evt: any) => {
				// SSE event format: `event: <type>\ndata: <json>\n\n`
				// biome-ignore lint/suspicious/noExplicitAny: untyped pubsub payload
				const e = evt as any;
				res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
			},
		);

		// Heartbeat to keep proxies from dropping the connection
		const heartbeat = setInterval(() => res.write(":\n\n"), 15_000);

		req.on("close", async () => {
			clearInterval(heartbeat);
			await sub.unsubscribe();
		});
	});

	// Graceful shutdown — drain in-flight buffer + engine before exit
	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log("\n🛑 Shutting down...");
		server.close();
		await shutdownAgents();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	const server = app.listen(PORT, () => {
		console.log(
			`\n✅ Express + agent engine ready at http://localhost:${PORT}`,
		);
		console.log(`   Tenant: ${TENANT_ID}`);
		console.log(`   Try:`);
		console.log(
			`     curl -s -X POST http://localhost:${PORT}/api/workflows/start-async \\`,
		);
		console.log(`       -H 'Content-Type: application/json' \\`);
		console.log(
			`       -d '{"workflowName":"fast_single","input":{"hi":"world"}}'`,
		);
		console.log();
	});
}

// ── Entrypoint: cluster primary vs worker ─────────────────────────────
//
// Node cluster shares the HTTP port across N worker processes (kernel does
// round-robin), and each worker independently subscribes to the same BullMQ
// queues (Redis BRPOP naturally distributes jobs). All workers share the
// same Postgres + Redis — no in-process state needs to be coordinated.
//
// In production, prefer this over running multiple containers when a single
// container has multiple vCPU. For Cloud Run instances with ≥2 vCPU, set
// CLUSTER_MODE=auto and you'll fork cores-1 workers per instance.

const N = desiredWorkers();
if (cluster.isPrimary && N > 1) {
	console.log(
		`🧠 Primary pid=${process.pid} — forking ${N} workers (CLUSTER_MODE=${process.env.CLUSTER_MODE ?? "auto"})`,
	);
	for (let i = 0; i < N; i++) cluster.fork({ CLUSTER_WORKER_ID: String(i) });
	cluster.on("exit", (worker, code, signal) => {
		console.log(
			`  ⚠️  Worker ${worker.id} exited (code=${code} signal=${signal}); re-forking`,
		);
		if (!(worker as { exitedAfterDisconnect?: boolean }).exitedAfterDisconnect)
			cluster.fork();
	});
	process.on("SIGINT", () => {
		for (const w of Object.values(cluster.workers ?? {})) w?.kill("SIGTERM");
		setTimeout(() => process.exit(0), 3000);
	});
	process.on("SIGTERM", () => {
		for (const w of Object.values(cluster.workers ?? {})) w?.kill("SIGTERM");
		setTimeout(() => process.exit(0), 3000);
	});
} else {
	main().catch((err) => {
		console.error("Fatal:", err);
		process.exit(1);
	});
}
