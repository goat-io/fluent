// npx vitest run src/__tests__/engine/dbos-parity.spec.ts
//
// PostgreSQL LISTEN/NOTIFY for low-latency workflow event dispatch.
// Inspired by DBOS — auto-detects PgBouncer transaction-pooling mode
// and falls back to polling.
//
// Channels:
//   delphi_step_completed — fired when a step completes
//   delphi_signal         — fired when a signal is received
//
// Payload format: "workflowRunId::stepName" or "workflowRunId::signalName"

import type { Pool, PoolClient } from 'pg'

export type NotifyChannel = 'delphi_step_completed' | 'delphi_signal'

export interface PgNotifierConfig {
  pgPool: Pool
  /** Channels to listen on */
  channels?: NotifyChannel[]
  /** Callback when a notification is received */
  onNotification?: (channel: NotifyChannel, payload: string) => void
  /** Logger */
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

/**
 * SQL to create NOTIFY trigger functions.
 * Add to migration system — these are idempotent (CREATE OR REPLACE).
 */
export const PG_NOTIFY_SQL = [
  // Trigger function for step completion
  `CREATE OR REPLACE FUNCTION delphi_notify_step_completed()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.status IN ('COMPLETED', 'FAILED') AND OLD.status != NEW.status THEN
       PERFORM pg_notify('delphi_step_completed', NEW."workflowRunId" || '::' || NEW."stepName");
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  // Trigger on workflow_steps
  `DO $$ BEGIN
     CREATE TRIGGER trg_delphi_step_completed
       AFTER UPDATE ON workflow_steps
       FOR EACH ROW EXECUTE FUNCTION delphi_notify_step_completed();
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  // Trigger function for signals
  `CREATE OR REPLACE FUNCTION delphi_notify_signal()
   RETURNS TRIGGER AS $$
   BEGIN
     PERFORM pg_notify('delphi_signal', NEW."workflowRunId" || '::' || NEW."signalName");
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  // Trigger on workflow_signals
  `DO $$ BEGIN
     CREATE TRIGGER trg_delphi_signal
       AFTER INSERT ON workflow_signals
       FOR EACH ROW EXECUTE FUNCTION delphi_notify_signal();
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
]

export class PgNotifier {
  private client: PoolClient | null = null
  private config: PgNotifierConfig
  private channels: NotifyChannel[]
  private active = false

  constructor(config: PgNotifierConfig) {
    this.config = config
    this.channels = config.channels ?? [
      'delphi_step_completed',
      'delphi_signal',
    ]
  }

  /**
   * Start listening. Self-tests LISTEN/NOTIFY on startup (DBOS pattern).
   * Returns false if LISTEN/NOTIFY is unavailable (e.g., PgBouncer transaction mode).
   */
  async start(): Promise<boolean> {
    try {
      // Self-test: send + receive a notification on a test channel
      const testOk = await this.selfTest()
      if (!testOk) {
        this.config.logger?.warn(
          '[PgNotifier] LISTEN/NOTIFY self-test failed (likely PgBouncer transaction-pooling mode). Falling back to polling.',
        )
        return false
      }

      // Acquire a dedicated connection for LISTEN
      this.client = await this.config.pgPool.connect()

      this.client.on('notification', msg => {
        if (msg.channel && msg.payload) {
          this.config.onNotification?.(
            msg.channel as NotifyChannel,
            msg.payload,
          )
        }
      })

      // Handle connection errors — reconnect
      this.client.on('error', err => {
        this.config.logger?.warn(
          '[PgNotifier] Connection error, reconnecting',
          err.message,
        )
        this.reconnect()
      })

      for (const channel of this.channels) {
        await this.client.query(`LISTEN ${channel}`)
      }

      this.active = true
      this.config.logger?.info(
        `[PgNotifier] Listening on: ${this.channels.join(', ')}`,
      )
      return true
    } catch (err) {
      this.config.logger?.warn(
        '[PgNotifier] Failed to start LISTEN/NOTIFY',
        (err as Error).message,
      )
      return false
    }
  }

  /**
   * DBOS pattern: self-test LISTEN/NOTIFY by sending and waiting for a test notification.
   * Returns false if notification is not received within 3 seconds.
   */
  private async selfTest(): Promise<boolean> {
    const testChannel = 'delphi_selftest'
    const testPayload = `test_${Date.now()}`
    let client: PoolClient | null = null

    try {
      client = await this.config.pgPool.connect()
      let received = false

      client.on('notification', msg => {
        if (msg.channel === testChannel && msg.payload === testPayload) {
          received = true
        }
      })

      await client.query(`LISTEN ${testChannel}`)
      await client.query(`NOTIFY ${testChannel}, '${testPayload}'`)

      // Wait up to 3 seconds
      for (let i = 0; i < 30 && !received; i++) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      await client.query(`UNLISTEN ${testChannel}`)
      return received
    } catch {
      return false
    } finally {
      client?.release()
    }
  }

  private async reconnect(): Promise<void> {
    try {
      this.client?.release()
    } catch {
      // ignore
    }
    this.client = null
    // Retry after 1 second
    await new Promise(resolve => setTimeout(resolve, 1000))
    await this.start()
  }

  async shutdown(): Promise<void> {
    this.active = false
    if (this.client) {
      for (const channel of this.channels) {
        try {
          await this.client.query(`UNLISTEN ${channel}`)
        } catch {
          // ignore
        }
      }
      this.client.release()
      this.client = null
    }
  }

  isActive(): boolean {
    return this.active
  }

  /**
   * Parse notification payload. Format: "workflowRunId::name"
   */
  static parsePayload(payload: string): { runId: string; name: string } {
    const [runId, name] = payload.split('::', 2)
    return { runId, name }
  }
}
