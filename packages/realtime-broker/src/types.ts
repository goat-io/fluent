// Generic broker types — backend-agnostic so we can swap ioredis for NATS,
// Kafka, in-memory, etc. later without touching consumers.

/** Handler invoked when a message arrives on a subscribed channel. */
export type RealtimeHandler<T = unknown> = (data: T, channel: string) => void;

/** Handle returned from subscribe — call .unsubscribe() to clean up. */
export interface RealtimeSubscription {
	/**
	 * Remove this subscription. If it's the last subscription on the channel,
	 * the broker may unsubscribe from the underlying transport (saves Redis
	 * SUBSCRIBE state). Idempotent — calling twice is a no-op.
	 */
	unsubscribe(): Promise<void>;
	/** True if `unsubscribe` has been called. */
	readonly closed: boolean;
}

export interface RealtimeBroker {
	/**
	 * Subscribe to a tenant-scoped channel. Multiple subscriptions to the same
	 * (tenant, channel) share the underlying transport connection — fan-out
	 * happens in-process.
	 */
	subscribe<T = unknown>(
		tenantId: string,
		channel: string,
		handler: RealtimeHandler<T>,
	): Promise<RealtimeSubscription>;

	/**
	 * Publish a message to a tenant-scoped channel. Returns the number of
	 * remote subscribers reached (best-effort; not all backends report this).
	 */
	publish(tenantId: string, channel: string, data: unknown): Promise<number>;

	/** Close all underlying connections. Idempotent. */
	close(): Promise<void>;

	/** Diagnostic — current count of distinct (tenant, channel) subscriptions. */
	subscriptionCount(): number;

	/** Diagnostic — current count of distinct tenants with active subscribers. */
	tenantCount(): number;
}
