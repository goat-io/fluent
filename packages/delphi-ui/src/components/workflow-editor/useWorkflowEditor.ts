import type { Connection, Edge, Node } from '@xyflow/react'
import dagre from 'dagre'
import { useCallback, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────

export type ExecutorType =
  | 'function'
  | 'ai'
  | 'sandbox'
  | 'human'
  | 'task_runner'
  | 'claude_code'
export type StepWeight = 'light' | 'heavy' | 'ai' | 'sandbox'

export interface StepConfig {
  name: string
  executorType: ExecutorType
  executorConfig: Record<string, unknown>
  retries: number
  timeoutMs: number
  weight: StepWeight
  maxIterations: number
  nextStep?: string
  dependsOn: string[]
  requiresHumanApproval: boolean
  heartbeatTimeoutMs?: number
  scheduleToStartTimeoutMs?: number
  conditionExpression?: string
  mapInputExpression?: string
}

export interface TriggerConfig {
  type: 'event' | 'manual' | 'schedule'
  eventType?: string
  cronExpression?: string
}

export interface BudgetConfig {
  maxTokens?: number
  maxCostUsd?: number
  maxSteps?: number
  maxTaskExecutions?: number
}

export interface WorkflowDefinitionJson {
  name: string
  version: string
  defaultRetries: number
  defaultTimeoutMs: number
  failFast: boolean
  triggers?: Array<{
    type: 'event' | 'manual' | 'schedule'
    eventType?: string
    cronExpression?: string
  }>
  budget?: {
    maxTokens?: number
    maxCostUsd?: number
    maxSteps?: number
    maxTaskExecutions?: number
  }
  steps: Array<{
    name: string
    dependsOn?: string[]
    executorType: string
    executorConfig: Record<string, unknown>
    retries?: number
    timeoutMs?: number
    weight?: string
    maxIterations?: number
    nextStep?: string
    requiresHumanApproval?: boolean
    heartbeatTimeoutMs?: number
    scheduleToStartTimeoutMs?: number
    condition?: string
    mapInput?: string
  }>
}

export interface ValidationError {
  type: 'error' | 'warning'
  message: string
  stepId?: string
}

// ── Helpers ───────────────────────────────────────────────────────

let nodeCounter = 0

function generateNodeId(): string {
  nodeCounter += 1
  return `step_${nodeCounter}_${Date.now()}`
}

const DEFAULT_STEP_CONFIG: Omit<StepConfig, 'name'> = {
  executorType: 'function',
  executorConfig: {},
  retries: 3,
  timeoutMs: 300_000,
  weight: 'light',
  maxIterations: 1,
  dependsOn: [],
  requiresHumanApproval: false,
}

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) {
    return nodes
  }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })

  for (const node of nodes) {
    g.setNode(node.id, { width: 220, height: 80 })
  }

  for (const edge of edges) {
    if (edge.data?.type !== 'nextStep') {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    if (!pos) {
      return node
    }
    return {
      ...node,
      position: { x: pos.x - 110, y: pos.y - 40 },
    }
  })
}

// ── Cycle Detection ───────────────────────────────────────────────

function hasCycle(nodes: Node[], edges: Edge[]): string | null {
  const depEdges = edges.filter(e => e.data?.type !== 'nextStep')
  const adj = new Map<string, string[]>()
  const ids = new Set(nodes.map(n => n.id))

  for (const id of ids) {
    adj.set(id, [])
  }
  for (const e of depEdges) {
    adj.get(e.source)?.push(e.target)
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()

  function dfs(id: string): string | null {
    if (visiting.has(id)) {
      return id
    }
    if (visited.has(id)) {
      return null
    }
    visiting.add(id)
    for (const next of adj.get(id) ?? []) {
      const cycleNode = dfs(next)
      if (cycleNode) {
        return cycleNode
      }
    }
    visiting.delete(id)
    visited.add(id)
    return null
  }

  for (const id of ids) {
    const cycleNode = dfs(id)
    if (cycleNode) {
      return cycleNode
    }
  }
  return null
}

// ── Hook ──────────────────────────────────────────────────────────

export function useWorkflowEditor() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [workflowName, setWorkflowName] = useState('my-workflow')
  const [workflowVersion, setWorkflowVersion] = useState('1.0.0')
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  )

  // Workflow-level settings
  const [defaultRetries, setDefaultRetries] = useState(3)
  const [defaultTimeoutMs, setDefaultTimeoutMs] = useState(300_000)
  const [failFast, setFailFast] = useState(false)
  const [triggers, setTriggers] = useState<TriggerConfig[]>([])
  const [budget, setBudget] = useState<BudgetConfig>({})
  const [showSettings, setShowSettings] = useState(false)

  const stepConfigsRef = useRef<Map<string, StepConfig>>(new Map())

  // ── Node Operations ──────────────────────────────────────────

  const addStep = useCallback(
    (
      type: ExecutorType,
      position?: { x: number; y: number },
      prefilledConfig?: Record<string, unknown>,
    ) => {
      const id = generateNodeId()
      const name = `${type}_step_${nodes.length + 1}`
      const config: StepConfig = {
        ...DEFAULT_STEP_CONFIG,
        name,
        executorType: type,
        requiresHumanApproval: type === 'human',
        ...(prefilledConfig ? { executorConfig: prefilledConfig } : {}),
      }
      stepConfigsRef.current.set(id, config)

      const newNode: Node = {
        id,
        type: 'editorStep',
        position: position ?? {
          x: 100 + nodes.length * 50,
          y: 100 + nodes.length * 120,
        },
        data: { config, id },
      }

      setNodes(prev => {
        const next = [...prev, newNode]
        return layoutNodes(next, edges)
      })
      setSelectedNodeId(id)
      return id
    },
    [nodes.length, edges],
  )

  const removeStep = useCallback(
    (id: string) => {
      stepConfigsRef.current.delete(id)
      setNodes(prev => prev.filter(n => n.id !== id))
      setEdges(prev => prev.filter(e => e.source !== id && e.target !== id))
      if (selectedNodeId === id) {
        setSelectedNodeId(null)
      }

      // Clean dependsOn references
      for (const [, cfg] of stepConfigsRef.current) {
        cfg.dependsOn = cfg.dependsOn.filter(dep => dep !== id)
      }
    },
    [selectedNodeId],
  )

  const updateStep = useCallback((id: string, partial: Partial<StepConfig>) => {
    const current = stepConfigsRef.current.get(id)
    if (!current) {
      return
    }
    const updated = { ...current, ...partial }
    stepConfigsRef.current.set(id, updated)

    setNodes(prev =>
      prev.map(n =>
        n.id === id ? { ...n, data: { ...n.data, config: updated } } : n,
      ),
    )
  }, [])

  // ── Edge Operations ──────────────────────────────────────────

  const connectSteps = useCallback((sourceId: string, targetId: string) => {
    const edgeId = `dep-${sourceId}-${targetId}`

    setEdges(prev => {
      if (prev.some(e => e.id === edgeId)) {
        return prev
      }
      return [
        ...prev,
        {
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: 'default',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          data: { type: 'dependency' },
        },
      ]
    })

    // Update dependsOn
    const targetCfg = stepConfigsRef.current.get(targetId)
    if (targetCfg && !targetCfg.dependsOn.includes(sourceId)) {
      targetCfg.dependsOn = [...targetCfg.dependsOn, sourceId]
    }
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connectSteps(connection.source, connection.target)
      }
    },
    [connectSteps],
  )

  const addNextStepEdge = useCallback((sourceId: string, targetId: string) => {
    const edgeId = `next-${sourceId}-${targetId}`

    setEdges(prev => {
      if (prev.some(e => e.id === edgeId)) {
        return prev
      }
      return [
        ...prev,
        {
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: 'default',
          animated: true,
          style: {
            stroke: '#8b5cf6',
            strokeWidth: 2,
            strokeDasharray: '8 4',
          },
          data: { type: 'nextStep' },
          label: 'nextStep',
          labelStyle: { fill: '#8b5cf6', fontSize: 11 },
        },
      ]
    })

    // Update source config
    const sourceCfg = stepConfigsRef.current.get(sourceId)
    if (sourceCfg) {
      sourceCfg.nextStep = targetId
    }
  }, [])

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => {
      const edge = prev.find(e => e.id === edgeId)
      if (edge) {
        if (edge.data?.type === 'nextStep') {
          const cfg = stepConfigsRef.current.get(edge.source)
          if (cfg) {
            cfg.nextStep = undefined
          }
        } else {
          const cfg = stepConfigsRef.current.get(edge.target)
          if (cfg) {
            cfg.dependsOn = cfg.dependsOn.filter(d => d !== edge.source)
          }
        }
      }
      return prev.filter(e => e.id !== edgeId)
    })
  }, [])

  // ── Serialization ────────────────────────────────────────────

  const toWorkflowDefinition = useCallback((): WorkflowDefinitionJson => {
    const steps: WorkflowDefinitionJson['steps'] = []

    // Build ID-to-name map
    const idToName = new Map<string, string>()
    for (const [id, cfg] of stepConfigsRef.current) {
      idToName.set(id, cfg.name)
    }

    for (const [_id, cfg] of stepConfigsRef.current) {
      const dependsOn = cfg.dependsOn
        .map(depId => idToName.get(depId))
        .filter(Boolean) as string[]

      const step: WorkflowDefinitionJson['steps'][number] = {
        name: cfg.name,
        executorType: cfg.executorType,
        executorConfig: cfg.executorConfig,
        retries: cfg.retries,
        timeoutMs: cfg.timeoutMs,
      }

      if (dependsOn.length > 0) {
        step.dependsOn = dependsOn
      }
      if (cfg.weight !== 'light') {
        step.weight = cfg.weight
      }
      if (cfg.maxIterations > 1) {
        step.maxIterations = cfg.maxIterations
      }
      if (cfg.nextStep) {
        const nextName = idToName.get(cfg.nextStep)
        if (nextName) {
          step.nextStep = nextName
        }
      }
      if (cfg.requiresHumanApproval) {
        step.requiresHumanApproval = true
      }
      if (cfg.heartbeatTimeoutMs) {
        step.heartbeatTimeoutMs = cfg.heartbeatTimeoutMs
      }
      if (cfg.scheduleToStartTimeoutMs) {
        step.scheduleToStartTimeoutMs = cfg.scheduleToStartTimeoutMs
      }
      if (cfg.conditionExpression?.trim()) {
        step.condition = cfg.conditionExpression.trim()
      }
      if (cfg.mapInputExpression?.trim()) {
        step.mapInput = cfg.mapInputExpression.trim()
      }

      steps.push(step)
    }

    const def: WorkflowDefinitionJson = {
      name: workflowName,
      version: workflowVersion,
      defaultRetries,
      defaultTimeoutMs,
      failFast,
      steps,
    }

    if (triggers.length > 0) {
      def.triggers = triggers
    }
    const hasBudget =
      budget.maxTokens ||
      budget.maxCostUsd ||
      budget.maxSteps ||
      budget.maxTaskExecutions
    if (hasBudget) {
      def.budget = budget
    }

    return def
  }, [
    workflowName,
    workflowVersion,
    defaultRetries,
    defaultTimeoutMs,
    failFast,
    triggers,
    budget,
  ])

  const fromWorkflowDefinition = useCallback((def: WorkflowDefinitionJson) => {
    // Reset
    stepConfigsRef.current.clear()
    nodeCounter = 0

    setWorkflowName(def.name || 'my-workflow')
    setWorkflowVersion(def.version || '1.0.0')
    setDefaultRetries(def.defaultRetries ?? 3)
    setDefaultTimeoutMs(def.defaultTimeoutMs ?? 300_000)
    setFailFast(def.failFast ?? false)
    setTriggers(def.triggers ?? [])
    setBudget(def.budget ?? {})

    // Create name-to-id map
    const nameToId = new Map<string, string>()
    const newNodes: Node[] = []

    for (const step of def.steps) {
      const id = generateNodeId()
      nameToId.set(step.name, id)
    }

    for (const step of def.steps) {
      const id = nameToId.get(step.name)!
      const dependsOn = (step.dependsOn ?? [])
        .map(dep => nameToId.get(dep))
        .filter(Boolean) as string[]

      const config: StepConfig = {
        name: step.name,
        executorType: (step.executorType as ExecutorType) || 'function',
        executorConfig: step.executorConfig || {},
        retries: step.retries ?? def.defaultRetries ?? 3,
        timeoutMs: step.timeoutMs ?? def.defaultTimeoutMs ?? 300_000,
        weight: (step.weight as StepWeight) || 'light',
        maxIterations: step.maxIterations ?? 1,
        dependsOn,
        nextStep: step.nextStep ? nameToId.get(step.nextStep) : undefined,
        requiresHumanApproval: step.requiresHumanApproval ?? false,
        heartbeatTimeoutMs: step.heartbeatTimeoutMs,
        scheduleToStartTimeoutMs: step.scheduleToStartTimeoutMs,
        conditionExpression: step.condition,
        mapInputExpression: step.mapInput,
      }

      stepConfigsRef.current.set(id, config)

      newNodes.push({
        id,
        type: 'editorStep',
        position: { x: 0, y: 0 },
        data: { config, id },
      })
    }

    // Build edges
    const newEdges: Edge[] = []
    for (const [id, cfg] of stepConfigsRef.current) {
      for (const depId of cfg.dependsOn) {
        newEdges.push({
          id: `dep-${depId}-${id}`,
          source: depId,
          target: id,
          type: 'default',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          data: { type: 'dependency' },
        })
      }
      if (cfg.nextStep) {
        newEdges.push({
          id: `next-${id}-${cfg.nextStep}`,
          source: id,
          target: cfg.nextStep,
          type: 'default',
          animated: true,
          style: {
            stroke: '#8b5cf6',
            strokeWidth: 2,
            strokeDasharray: '8 4',
          },
          data: { type: 'nextStep' },
          label: 'nextStep',
          labelStyle: { fill: '#8b5cf6', fontSize: 11 },
        })
      }
    }

    const laid = layoutNodes(newNodes, newEdges)
    setNodes(laid)
    setEdges(newEdges)
    setSelectedNodeId(null)
    setValidationErrors([])
  }, [])

  // ── Validation ───────────────────────────────────────────────

  const validate = useCallback((): ValidationError[] => {
    const errs: ValidationError[] = []

    if (!workflowName.trim()) {
      errs.push({ type: 'error', message: 'Workflow name is required' })
    }

    if (!workflowVersion.trim()) {
      errs.push({ type: 'error', message: 'Workflow version is required' })
    }

    if (nodes.length === 0) {
      errs.push({
        type: 'error',
        message: 'Workflow must have at least one step',
      })
    }

    // Check step names
    const names = new Set<string>()
    for (const [id, cfg] of stepConfigsRef.current) {
      if (!cfg.name.trim()) {
        errs.push({
          type: 'error',
          message: `Step has an empty name`,
          stepId: id,
        })
      }
      if (names.has(cfg.name)) {
        errs.push({
          type: 'error',
          message: `Duplicate step name: "${cfg.name}"`,
          stepId: id,
        })
      }
      names.add(cfg.name)
    }

    // Check dependency references
    const nodeIds = new Set(nodes.map(n => n.id))
    for (const [id, cfg] of stepConfigsRef.current) {
      for (const dep of cfg.dependsOn) {
        if (!nodeIds.has(dep)) {
          errs.push({
            type: 'error',
            message: `Step "${cfg.name}" depends on non-existent step`,
            stepId: id,
          })
        }
      }
      if (cfg.dependsOn.includes(id)) {
        errs.push({
          type: 'error',
          message: `Step "${cfg.name}" depends on itself`,
          stepId: id,
        })
      }
    }

    // Check cycles
    const cycleNode = hasCycle(nodes, edges)
    if (cycleNode) {
      const cfg = stepConfigsRef.current.get(cycleNode)
      errs.push({
        type: 'error',
        message: `Cycle detected involving step "${cfg?.name ?? cycleNode}"`,
        stepId: cycleNode,
      })
    }

    // Validate triggers
    for (const trigger of triggers) {
      if (trigger.type === 'event' && !trigger.eventType?.trim()) {
        errs.push({
          type: 'warning',
          message: 'Event trigger missing eventType',
        })
      }
    }

    // Warnings
    for (const [id, cfg] of stepConfigsRef.current) {
      if (cfg.retries < 0) {
        errs.push({
          type: 'warning',
          message: `Step "${cfg.name}" has negative retries`,
          stepId: id,
        })
      }
      if (cfg.timeoutMs <= 0) {
        errs.push({
          type: 'warning',
          message: `Step "${cfg.name}" has non-positive timeout`,
          stepId: id,
        })
      }
      if (cfg.executorType === 'task_runner') {
        const ec = cfg.executorConfig
        if (!ec.executor) {
          errs.push({
            type: 'warning',
            message: `Task runner step "${cfg.name}" has no inner executor type`,
            stepId: id,
          })
        }
      }
    }

    setValidationErrors(errs)
    return errs
  }, [workflowName, workflowVersion, nodes, edges, triggers])

  const getValidationErrors = useCallback(
    () => validationErrors,
    [validationErrors],
  )

  // ── Clear ────────────────────────────────────────────────────

  const clear = useCallback(() => {
    stepConfigsRef.current.clear()
    nodeCounter = 0
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setWorkflowName('my-workflow')
    setWorkflowVersion('1.0.0')
    setDefaultRetries(3)
    setDefaultTimeoutMs(300_000)
    setFailFast(false)
    setTriggers([])
    setBudget({})
    setValidationErrors([])
    setShowSettings(false)
  }, [])

  // ── Auto-layout ──────────────────────────────────────────────

  const autoLayout = useCallback(() => {
    setNodes(prev => layoutNodes(prev, edges))
  }, [edges])

  // ── Get step config by ID ────────────────────────────────────

  const getStepConfig = useCallback((id: string): StepConfig | undefined => {
    return stepConfigsRef.current.get(id)
  }, [])

  const getStepConfigs = useCallback((): Map<string, StepConfig> => {
    return stepConfigsRef.current
  }, [])

  return {
    // State
    nodes,
    edges,
    selectedNodeId,
    workflowName,
    workflowVersion,
    validationErrors,

    // Workflow-level settings
    defaultRetries,
    defaultTimeoutMs,
    failFast,
    triggers,
    budget,
    showSettings,
    setDefaultRetries,
    setDefaultTimeoutMs,
    setFailFast,
    setTriggers,
    setBudget,
    setShowSettings,

    // Setters
    setNodes,
    setEdges,
    setSelectedNodeId,
    setWorkflowName,
    setWorkflowVersion,

    // Node operations
    addStep,
    removeStep,
    updateStep,
    getStepConfig,
    getStepConfigs,

    // Edge operations
    connectSteps,
    onConnect,
    addNextStepEdge,
    removeEdge,

    // Serialization
    toWorkflowDefinition,
    fromWorkflowDefinition,

    // Validation
    validate,
    getValidationErrors,

    // Layout / clear
    autoLayout,
    clear,
  }
}

export type WorkflowEditorState = ReturnType<typeof useWorkflowEditor>
