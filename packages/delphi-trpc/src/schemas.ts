// Zod input/output schemas — kept small and stable. Mirrors what
// createWorkflowHandlers in @goatlab/delphi-core expects.

import { z } from "zod";

const triggerInputBase = {
	workflowName: z.string(),
	input: z.record(z.string(), z.unknown()).default({}),
	idempotencyKey: z.string().optional(),
	traceId: z.string().optional(),
	parentRunId: z.string().optional(),
	originEventId: z.string().optional(),
	priority: z.number().optional(),
} as const;

export const startInputSchema = z.object(triggerInputBase);
export const startAsyncInputSchema = z.object(triggerInputBase);

export const startBatchInputSchema = z.object({
	workflows: z.array(z.object(triggerInputBase)).min(1).max(1000),
});

export const statusInputSchema = z.object({
	runId: z.string(),
});

export const cancelInputSchema = z.object({
	runId: z.string(),
});

export const humanInputSchema = z.object({
	workflowRunId: z.string(),
	stepName: z.string(),
	data: z.unknown(),
	respondedBy: z.string().optional(),
});

export const signalInputSchema = z.object({
	runId: z.string(),
	signalName: z.string(),
	data: z.unknown(),
});

export const queryInputSchema = z.object({
	status: z.array(z.string()).optional(),
	workflowName: z.string().optional(),
	limit: z.number().int().positive().max(500).optional(),
	offset: z.number().int().min(0).optional(),
});

export const ingestEventInputSchema = z.object({
	eventType: z.string(),
	source: z.string(),
	payload: z.record(z.string(), z.unknown()).default({}),
	idempotencyKey: z.string().optional(),
	entityKey: z.string().optional(),
	sequenceNumber: z.number().optional(),
	traceId: z.string().optional(),
});

export const startAsyncOutputSchema = z.object({
	runId: z.string(),
	traceId: z.string(),
	status: z.literal("QUEUED"),
});
