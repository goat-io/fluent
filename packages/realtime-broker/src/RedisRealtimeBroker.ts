// RedisRealtimeBroker — pooled per-tenant pub/sub via ioredis.
//
// The shape sodium uses today (lifted from apps/backend/src/api/realtime/
// shared-subscriber.ts and generalized).
//
// CRITICAL DESIGN: O(tenants) Redis connections, NOT O(users).
//   - One ioredis SUBSCRIBE connection per tenant
//   - Multiple in-process listeners (SSE sessions, internal hooks) share
//     it via an in-memory Map<channel, Set<handler>>
//   - On subscribe: SUBSCRIBE only when the channel is new; on unsubscribe:
//     UNSUBSCRIBE only when the last handler leaves
//
// A tenant with 1000 connected SSE users uses 1 Redis connection here.
// Without this pattern, you'd need 1000 — guaranteed Redis connection
// limit exhaustion at scale.
//
// Channel naming convention (matches sodium):
//   `tenant:{tenantId}:{channel}`
// Override via `channelKey()` if you want a different namespacing scheme.

import { Redis, type RedisOptions } from "ioredis";
import type {
	RealtimeBroker,
	RealtimeHandler,
	RealtimeSubscription,
} from "./types.js";

export interface RedisRealtimeBrokerConfig {
	/**
	 * ioredis options OR a factory that returns a fresh ioredis client.
	 * Factory form preferred when you need different credentials per tenant
	 * (Redis ACL multi-tenancy).
	 */
	redis: RedisOptions | (() => Redis);
	/**
	 * Optional per-tenant credential lookup. Called on first subscribe for a
	 * tenant. Return overrides for the ioredis options. Useful when each
	 * tenant has its own Redis ACL user.
	 */
	perTenantCredentials?: (
		tenantId: string,
	) => Promise<Partial<RedisOptions> | null>;
	/**
	 * Override the channel key naming. Default: `tenant:{tenantId}:{channel}`.
	 * Sodium uses this exact pattern.
	 */
	channelKey?: (tenantId: string, channel: string) => string;
	logger?: {
		info?: (...a: unknown[]) => void;
		warn?: (...a: unknown[]) => void;
		error?: (...a: unknown[]) => void;
	};
}

/**
 * Per-tenant subscriber: owns one ioredis SUBSCRIBE connection plus the
 * Map<channel, Set<handler>> that fans messages out in-process.
 */
class TenantSubscriber {
	private redis: Redis;
	private channels = new Map<string, Set<RealtimeHandler>>();
	private ready: Promise<void>;
	private closed = false;

	constructor(redis: Redis) {
		this.redis = redis;
		// Wait for the connection to be ready before issuing SUBSCRIBE.
		// Without this, the first SUBSCRIBE may race with auth/TLS handshake.
		this.ready = new Promise<void>((resolve, reject) => {
			if (redis.status === "ready") return resolve();
			redis.once("ready", resolve);
			redis.once("error", reject);
		});

		// Single message handler dispatches to all handlers for that channel
		redis.on("message", (channel: string, payload: string) => {
			const handlers = this.channels.get(channel);
			if (!handlers || handlers.size === 0) return;
			let parsed: unknown;
			try {
				parsed = JSON.parse(payload);
			} catch {
				parsed = payload;
			}
			for (const h of handlers) {
				try {
					h(parsed, channel);
				} catch {
					/* swallow — don't let one bad handler break others */
				}
			}
		});
	}

	async subscribe(channel: string, handler: RealtimeHandler): Promise<void> {
		if (this.closed) throw new Error("TenantSubscriber is closed");
		await this.ready;
		let handlers = this.channels.get(channel);
		if (!handlers) {
			handlers = new Set();
			this.channels.set(channel, handlers);
			// First handler for this channel — actually SUBSCRIBE on Redis
			await this.redis.subscribe(channel);
		}
		handlers.add(handler);
	}

	async unsubscribe(channel: string, handler: RealtimeHandler): Promise<void> {
		if (this.closed) return;
		const handlers = this.channels.get(channel);
		if (!handlers) return;
		handlers.delete(handler);
		if (handlers.size === 0) {
			this.channels.delete(channel);
			// Last handler left — UNSUBSCRIBE on Redis to free the slot
			await this.redis.unsubscribe(channel).catch(() => {});
		}
	}

	channelCount(): number {
		return this.channels.size;
	}
	isEmpty(): boolean {
		return this.channels.size === 0;
	}

	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		this.channels.clear();
		await this.redis.quit().catch(() => {});
	}
}

export class RedisRealtimeBroker implements RealtimeBroker {
	private subscribers = new Map<string, TenantSubscriber>();
	/** Lazy publisher — separate connection so SUBSCRIBE state doesn't block PUBLISH. */
	private publisher?: Redis;
	private readonly config: RedisRealtimeBrokerConfig;
	private closed = false;

	constructor(config: RedisRealtimeBrokerConfig) {
		this.config = config;
	}

	private newConnection(extra?: Partial<RedisOptions>): Redis {
		if (typeof this.config.redis === "function") return this.config.redis();
		return new Redis({ ...this.config.redis, ...extra, lazyConnect: false });
	}

	private channelKey(tenantId: string, channel: string): string {
		return this.config.channelKey
			? this.config.channelKey(tenantId, channel)
			: `tenant:${tenantId}:${channel}`;
	}

	private async getTenantSubscriber(
		tenantId: string,
	): Promise<TenantSubscriber> {
		let sub = this.subscribers.get(tenantId);
		if (sub) return sub;
		const creds = this.config.perTenantCredentials
			? await this.config.perTenantCredentials(tenantId).catch(() => null)
			: null;
		const redis = this.newConnection(creds ?? undefined);
		sub = new TenantSubscriber(redis);
		this.subscribers.set(tenantId, sub);
		return sub;
	}

	async subscribe<T = unknown>(
		tenantId: string,
		channel: string,
		handler: RealtimeHandler<T>,
	): Promise<RealtimeSubscription> {
		if (this.closed) throw new Error("RedisRealtimeBroker is closed");
		const sub = await this.getTenantSubscriber(tenantId);
		const key = this.channelKey(tenantId, channel);
		const wrapped = handler as RealtimeHandler;
		await sub.subscribe(key, wrapped);

		let closed = false;
		return {
			get closed() {
				return closed;
			},
			unsubscribe: async () => {
				if (closed) return;
				closed = true;
				await sub.unsubscribe(key, wrapped);
				// Reap empty subscribers — frees the Redis connection
				if (sub.isEmpty()) {
					this.subscribers.delete(tenantId);
					await sub.close();
				}
			},
		};
	}

	async publish(
		tenantId: string,
		channel: string,
		data: unknown,
	): Promise<number> {
		if (this.closed) throw new Error("RedisRealtimeBroker is closed");
		if (!this.publisher) {
			this.publisher = this.newConnection();
		}
		const key = this.channelKey(tenantId, channel);
		const payload = typeof data === "string" ? data : JSON.stringify(data);
		return this.publisher.publish(key, payload);
	}

	subscriptionCount(): number {
		let total = 0;
		for (const sub of this.subscribers.values()) total += sub.channelCount();
		return total;
	}

	tenantCount(): number {
		return this.subscribers.size;
	}

	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		const closes: Promise<void>[] = [];
		for (const sub of this.subscribers.values()) closes.push(sub.close());
		this.subscribers.clear();
		if (this.publisher) {
			closes.push(
				this.publisher
					.quit()
					.then(() => undefined)
					.catch(() => undefined),
			);
			this.publisher = undefined;
		}
		await Promise.all(closes);
	}
}
