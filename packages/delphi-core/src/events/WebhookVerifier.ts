// Webhook signature verification utilities
// npx vitest run src/__tests__/engine/event-ingestion.spec.ts

import { createHmac, timingSafeEqual } from 'node:crypto'

export class WebhookVerifier {
  /**
   * Verify an HMAC-SHA256 signature against a payload.
   * Returns true if the hex-encoded signature matches.
   */
  static verifyHmacSha256(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    if (expected.length !== signature.length) {
      return false
    }
    try {
      return timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      )
    } catch {
      return false
    }
  }

  /**
   * Verify a GitHub webhook signature.
   * GitHub sends the header as `sha256=<hex>`.
   */
  static verifyGitHub(
    payload: string,
    signatureHeader: string,
    secret: string,
  ): boolean {
    const prefix = 'sha256='
    const sig = signatureHeader.startsWith(prefix)
      ? signatureHeader.slice(prefix.length)
      : signatureHeader
    return WebhookVerifier.verifyHmacSha256(payload, sig, secret)
  }
}
