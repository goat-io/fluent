// npx vitest run src/__tests__/engine/integrations.spec.ts

import { createIntegrationAction } from '../createIntegrationAction.js'
import type { Integration } from '../Integration.js'

export interface SlackClient {
  sendMessage(req: {
    channel: string
    text: string
    threadTs?: string
  }): Promise<{ ts: string; channel: string }>
  updateMessage(req: {
    channel: string
    ts: string
    text: string
  }): Promise<{ ts: string; channel: string }>
}

export function createSlackIntegration(client: SlackClient): Integration {
  return {
    provider: 'slack',
    actions: {
      send_message: createIntegrationAction<
        { channel: string; text: string; threadTs?: string },
        { ts: string; channel: string }
      >('slack', 'send_message', async req => {
        const msg = await client.sendMessage(req)
        return { externalId: msg.ts, data: msg }
      }),

      update_message: createIntegrationAction<
        { channel: string; ts: string; text: string },
        { ts: string; channel: string }
      >('slack', 'update_message', async req => {
        const msg = await client.updateMessage(req)
        return { externalId: msg.ts, data: msg }
      }),
    },
  }
}
