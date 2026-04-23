// npx vitest run src/__tests__/state-machine.spec.ts

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export class WorkflowNotFoundError extends WorkflowError {
  constructor(workflowName: string) {
    super(`Workflow "${workflowName}" not found`, 'WORKFLOW_NOT_FOUND', {
      workflowName,
    })
    this.name = 'WorkflowNotFoundError'
  }
}

export class WorkflowRunNotFoundError extends WorkflowError {
  constructor(runId: string) {
    super(`Workflow run "${runId}" not found`, 'WORKFLOW_RUN_NOT_FOUND', {
      runId,
    })
    this.name = 'WorkflowRunNotFoundError'
  }
}

export class InvalidTransitionError extends WorkflowError {
  constructor(from: string, to: string, entity: string) {
    super(
      `Invalid ${entity} transition: ${from} → ${to}`,
      'INVALID_TRANSITION',
      { from, to, entity },
    )
    this.name = 'InvalidTransitionError'
  }
}

export class DAGValidationError extends WorkflowError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DAG_VALIDATION_ERROR', details)
    this.name = 'DAGValidationError'
  }
}

export class StepExecutionError extends WorkflowError {
  constructor(stepName: string, cause: Error) {
    super(
      `Step "${stepName}" execution failed: ${cause.message}`,
      'STEP_EXECUTION_ERROR',
      { stepName, cause: cause.message },
    )
    this.name = 'StepExecutionError'
    this.cause = cause
  }
}

export class NonRetryableError extends WorkflowError {
  readonly retryable = false

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NON_RETRYABLE', details)
    this.name = 'NonRetryableError'
  }
}

export class IdempotencyConflictError extends WorkflowError {
  constructor(
    idempotencyKey: string,
    public readonly existingRunId: string,
  ) {
    super(
      `Workflow with idempotency key "${idempotencyKey}" already exists`,
      'IDEMPOTENCY_CONFLICT',
      { idempotencyKey, existingRunId },
    )
    this.name = 'IdempotencyConflictError'
  }
}

export class HumanInputError extends WorkflowError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'HUMAN_INPUT_ERROR', details)
    this.name = 'HumanInputError'
  }
}

export class InputValidationError extends WorkflowError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INPUT_VALIDATION_ERROR', details)
    this.name = 'InputValidationError'
  }
}
