// Tests against a real Redis testcontainer. Verifies the per-tenant pooling,
// fan-out, lifecycle, and connection accounting that make this broker
// O(tenants) instead of O(users).
//
// npx vitest run src/RedisRealtimeBroker.spec.ts

import {
	RedisContainer,
	type StartedRedisContainer,
} from "@testcontainers/redis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RedisRealtimeBroker } from "./RedisRealtimeBroker.js";

describe("RedisRealtimeBroker", () => {
	let container: StartedRedisContainer;
	let broker: RedisRealtimeBroker;
	let host: string;
	let port: number;

	beforeAll(async () => {
		container = await new RedisContainer("redis:7-alpine").start();
		host = container.getHost();
		port = container.getMappedPort(6379);
	}, 60_000);

	afterAll(async () => {
		await broker?.close().catch(() => {});
		await container?.stop().catch(() => {});
	});

	beforeEach(async () => {
		if (broker) await broker.close().catch(() => {});
		broker = new RedisRealtimeBroker({
			redis: { host, port, maxRetriesPerRequest: null },
		});
	});

	// Helper: wait for predicate or timeout
	async function waitFor(p: () => boolean, ms = 2000) {
		const start = Date.now();
		while (Date.now() - start < ms) {
			if (p()) return;
			await new Promise((r) => setTimeout(r, 20));
		}
		throw new Error(`waitFor timed out after ${ms}ms`);
	}

	it("publish is delivered to a subscriber on the same channel", async () => {
		const received: unknown[] = [];
		await broker.subscribe("tenant-a", "orders", (data) => received.push(data));
		const n = await broker.publish("tenant-a", "orders", {
			id: 1,
			amount: 100,
		});
		expect(n).toBe(1); // 1 remote subscriber

		await waitFor(() => received.length === 1);
		expect(received[0]).toEqual({ id: 1, amount: 100 });
	});

	it("CRITICAL: many subscribers on same (tenant, channel) share ONE Redis connection", async () => {
		// The whole point of the pooling pattern. With 50 SSE sessions for one
		// tenant, we should still only use 1 Redis connection.
		const N = 50;
		const received: number[][] = Array.from({ length: N }, () => []);
		for (let i = 0; i < N; i++) {
			await broker.subscribe("tenant-x", "live", (data) => {
				received[i]!.push((data as { msg: number }).msg);
			});
		}

		expect(broker.tenantCount()).toBe(1); // ONE tenant
		expect(broker.subscriptionCount()).toBe(1); // ONE channel (with N handlers)

		await broker.publish("tenant-x", "live", { msg: 42 });
		await waitFor(() => received.every((r) => r.length === 1));
		for (const r of received) expect(r).toEqual([42]);
	}, 10_000);

	it("CRITICAL: tenants are isolated — publish to tenant A does NOT reach tenant B", async () => {
		const aReceived: unknown[] = [];
		const bReceived: unknown[] = [];
		await broker.subscribe("tenant-a", "data", (d) => aReceived.push(d));
		await broker.subscribe("tenant-b", "data", (d) => bReceived.push(d));

		expect(broker.tenantCount()).toBe(2); // two tenants, two connections

		await broker.publish("tenant-a", "data", { from: "A" });
		await waitFor(() => aReceived.length === 1);
		expect(aReceived).toEqual([{ from: "A" }]);
		expect(bReceived).toHaveLength(0); // tenant B unaffected

		await broker.publish("tenant-b", "data", { from: "B" });
		await waitFor(() => bReceived.length === 1);
		expect(bReceived).toEqual([{ from: "B" }]);
		expect(aReceived).toHaveLength(1); // tenant A still sees only its own
	});

	it("unsubscribing the last handler frees the Redis connection", async () => {
		const sub1 = await broker.subscribe("tenant-y", "ch", () => {});
		const sub2 = await broker.subscribe("tenant-y", "ch", () => {});
		expect(broker.tenantCount()).toBe(1);

		await sub1.unsubscribe();
		// Still one handler left → connection stays
		expect(broker.tenantCount()).toBe(1);

		await sub2.unsubscribe();
		// Last handler gone → tenant subscriber reaped
		expect(broker.tenantCount()).toBe(0);
	});

	it("unsubscribe is idempotent", async () => {
		const sub = await broker.subscribe("tenant-z", "ch", () => {});
		await sub.unsubscribe();
		expect(sub.closed).toBe(true);
		await sub.unsubscribe(); // no throw
		expect(sub.closed).toBe(true);
	});

	it("multiple channels on the same tenant share ONE connection", async () => {
		await broker.subscribe("tenant-multi", "channel-1", () => {});
		await broker.subscribe("tenant-multi", "channel-2", () => {});
		await broker.subscribe("tenant-multi", "channel-3", () => {});

		expect(broker.tenantCount()).toBe(1); // ONE tenant
		expect(broker.subscriptionCount()).toBe(3); // THREE channels
	});

	it("handler errors do not break sibling handlers", async () => {
		const okReceived: unknown[] = [];
		await broker.subscribe("tenant-err", "ch", () => {
			throw new Error("bad handler");
		});
		await broker.subscribe("tenant-err", "ch", (d) => okReceived.push(d));

		await broker.publish("tenant-err", "ch", { ok: true });
		await waitFor(() => okReceived.length === 1);
		expect(okReceived).toEqual([{ ok: true }]);
	});

	it("falls back to raw string if payload is not JSON", async () => {
		const received: unknown[] = [];
		await broker.subscribe("tenant-raw", "ch", (d) => received.push(d));
		await broker.publish("tenant-raw", "ch", "just-a-string");
		await waitFor(() => received.length === 1);
		expect(received[0]).toBe("just-a-string");
	});

	it("custom channelKey override works", async () => {
		const customBroker = new RedisRealtimeBroker({
			redis: { host, port, maxRetriesPerRequest: null },
			channelKey: (t, c) => `custom:${t}::${c}`,
		});
		const received: unknown[] = [];
		await customBroker.subscribe("t1", "foo", (d) => received.push(d));
		await customBroker.publish("t1", "foo", { hi: 1 });
		await waitFor(() => received.length === 1);
		expect(received).toEqual([{ hi: 1 }]);
		await customBroker.close();
	});

	it("close() drops all subscribers and connections", async () => {
		await broker.subscribe("a", "ch", () => {});
		await broker.subscribe("b", "ch", () => {});
		expect(broker.tenantCount()).toBe(2);

		await broker.close();
		expect(broker.tenantCount()).toBe(0);
		expect(broker.subscriptionCount()).toBe(0);
	});

	it("subscribing on a closed broker throws", async () => {
		await broker.close();
		await expect(broker.subscribe("t", "ch", () => {})).rejects.toThrow(
			/closed/,
		);
	});
});
