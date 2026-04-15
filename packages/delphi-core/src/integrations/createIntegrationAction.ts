// npx vitest run src/__tests__/engine/integrations.spec.ts
import type { IntegrationAction } from './Integration.js'

export function createIntegrationAction<TReq, TRes>(
  provider: string,
  actionType: string,
  fn: (request: TReq) => Promise<{ externalId: string; data: TRes }>,
): IntegrationAction<TReq, TRes> {
  return {
    actionType,
    async execute(request, context) {
      const idempotencyKey = `${context.workflowRunId}:${context.stepName}:${actionType}`
      return context.externalActions.execute(
        {
          workflowRunId: context.workflowRunId,
          stepName: context.stepName,
          attempt: context.attempt,
          tenantId: context.tenantId,
          provider,
          actionType,
          idempotencyKey,
          request: request as unknown as Record<string, unknown>,
        },
        async () => {
          const result = await fn(request)
          return {
            externalId: result.externalId,
            data: result.data as unknown as Record<string, unknown>,
          }
        },
      ) as any
    },
  }
}
