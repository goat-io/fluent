// npx vitest run src/__tests__/state-machine.spec.ts
import type {
  StepDefinition,
  StepStatus,
  WorkflowStatus,
} from '../workflow/WorkflowBuilder.types.js'

// ── Valid Transitions ──────────────────────────────────────────────

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING_HUMAN', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING_HUMAN: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  DELAYED: ['RUNNING', 'CANCELLED'],
}

const STEP_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  PENDING: ['QUEUED', 'SKIPPED'],
  QUEUED: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED', 'WAITING_HUMAN', 'SLEEPING'],
  COMPLETED: [],
  FAILED: ['QUEUED'], // retry
  SKIPPED: [],
  WAITING_HUMAN: ['QUEUED', 'COMPLETED'], // resume after human input, or complete directly
  SLEEPING: ['RUNNING', 'COMPLETED', 'FAILED'], // wake from durable sleep
}

// ── Transition Checks ──────────────────────────────────────────────

export function canWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false
}

export function canStepTransition(from: StepStatus, to: StepStatus): boolean {
  return STEP_TRANSITIONS[from]?.includes(to) ?? false
}

// ── Status Derivation ──────────────────────────────────────────────

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return WORKFLOW_TRANSITIONS[status]?.length === 0
}

export function isTerminalStepStatus(status: StepStatus): boolean {
  return STEP_TRANSITIONS[status]?.length === 0
}

/**
 * Derive workflow status from the current status of all its steps.
 * Priority: WAITING_HUMAN > FAILED > RUNNING > COMPLETED > PENDING
 */
export function deriveWorkflowStatus(
  steps: Array<{ status: StepStatus }>,
): WorkflowStatus {
  if (steps.length === 0) {
    return 'COMPLETED'
  }

  const hasWaiting = steps.some(s => s.status === 'WAITING_HUMAN')
  if (hasWaiting) {
    return 'WAITING_HUMAN'
  }

  const hasFailed = steps.some(s => s.status === 'FAILED')
  const hasActive = steps.some(
    s =>
      s.status === 'QUEUED' ||
      s.status === 'RUNNING' ||
      s.status === 'SLEEPING',
  )

  if (hasFailed && !hasActive) {
    return 'FAILED'
  }

  const allTerminal = steps.every(
    s => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  )
  if (allTerminal) {
    return 'COMPLETED'
  }

  if (hasActive) {
    return 'RUNNING'
  }

  // Some steps pending, some completed
  return 'RUNNING'
}

// ── Step Readiness ─────────────────────────────────────────────────

/**
 * Returns names of steps that are PENDING and whose dependencies
 * are all COMPLETED or SKIPPED.
 */
export function getReadySteps(
  steps: StepDefinition[],
  statuses: Record<string, StepStatus>,
): string[] {
  return steps
    .filter(step => {
      if (statuses[step.name] !== 'PENDING') {
        return false
      }
      const deps = step.dependsOn ?? []
      return deps.every(
        d => statuses[d] === 'COMPLETED' || statuses[d] === 'SKIPPED',
      )
    })
    .map(s => s.name)
}

/**
 * Topologically sort steps. Returns sorted names or throws on cycle.
 */
export function topologicalSort(steps: StepDefinition[]): string[] {
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const step of steps) {
    graph.set(step.name, [])
    inDegree.set(step.name, 0)
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      graph.get(dep)!.push(step.name)
      inDegree.set(step.name, (inDegree.get(step.name) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name)
    }
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (sorted.length !== steps.length) {
    const cycleNodes = steps.map(s => s.name).filter(n => !sorted.includes(n))
    throw new Error(
      `Cycle detected in workflow DAG involving: ${cycleNodes.join(', ')}`,
    )
  }

  return sorted
}
