// Bun server hosting the Goat agent engine via @goatlab/delphi-bun.
//
// Bun's HTTP server is much faster than Node's — typically 2-3× the
// req/sec ceiling on the same hardware. Bun also handles HTTP across
// multiple processes via reusePort: true (no node:cluster needed),
// so we spawn N worker processes that all bind the same port.
//
// Run:
//   bun run src/server.ts
// Or via package script:
//   bun run start

import { spawn } from "node:child_process";
import os from "node:os";
import { agentsBunHandler } from "@goatlab/delphi-bun";
import { getAgents, shutdownAgents } from "./agents.factory.ts";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const TENANT_ID = process.env.TENANT_ID ?? "demo-tenant";

function desiredWorkers(): number {
	const mode = process.env.CLUSTER_MODE ?? "auto";
	// Bun exposes os.availableParallelism via the Node compat layer
	const cores =
		(os as { availableParallelism?: () => number }).availableParallelism?.() ??
		os.cpus().length;
	if (mode === "off" || cores <= 1) return 1;
	if (mode === "auto") return Math.max(1, cores - 1);
	const n = parseInt(mode, 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

async function runServer() {
	// Boot engine + workers up front (no cold-start cost on first request)
	console.log(`[${process.env.WORKER_ID ?? "single"}] Booting engine...`);
	await getAgents();
	console.log(
		`[${process.env.WORKER_ID ?? "single"}] ✅ engine + workers ready`,
	);

	const handler = agentsBunHandler({
		resolveAgents: async (_req) => {
			const { engine } = await getAgents();
			return { engine, ingestBuffer: engine.ingestBuffer, tenantId: TENANT_ID };
		},
		prefix: "/api/workflows",
	});

	const server = Bun.serve({
		port: PORT,
		reusePort: true, // key: lets multiple Bun processes bind the same port
		async fetch(req: Request): Promise<Response> {
			const url = new URL(req.url);
			// Top-level health (cheap, no engine touch)
			if (url.pathname === "/health" && req.method === "GET") {
				return Response.json({ ok: true });
			}
			if (url.pathname.startsWith("/api/workflows")) {
				return handler(req);
			}
			return new Response("Not found", { status: 404 });
		},
	});

	// Graceful shutdown
	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`\n[${process.env.WORKER_ID ?? "single"}] 🛑 Shutting down...`);
		server.stop();
		await shutdownAgents();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	console.log(
		`[${process.env.WORKER_ID ?? "single"}] ✅ Bun + agent engine on http://localhost:${PORT}`,
	);
}

// ── Entrypoint: cluster primary spawns N workers; workers run runServer ──
//
// Bun doesn't ship `node:cluster`, but `reusePort: true` plus N spawned
// processes is the equivalent — kernel SO_REUSEPORT distributes incoming
// TCP connections across all workers.
const N = desiredWorkers();
const isWorker = !!process.env.WORKER_ID;

if (isWorker || N === 1) {
	runServer();
} else {
	console.log(
		`🧠 Primary pid=${process.pid} — spawning ${N} Bun workers (CLUSTER_MODE=${process.env.WORKER_ID ?? "auto"})`,
	);
	const children: ReturnType<typeof spawn>[] = [];
	for (let i = 0; i < N; i++) {
		const child = spawn(
			process.execPath,
			["run", new URL(import.meta.url).pathname],
			{
				env: { ...process.env, WORKER_ID: String(i) },
				stdio: "inherit",
			},
		);
		children.push(child);
	}
	const stop = () => {
		console.log("\n🛑 Primary: stopping workers...");
		for (const c of children) c.kill("SIGTERM");
		setTimeout(() => process.exit(0), 3000);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
}
