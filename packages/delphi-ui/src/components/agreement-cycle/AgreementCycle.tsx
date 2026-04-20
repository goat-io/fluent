/**
 * <AgreementCycle> — radial visualisation of an agreement-protocol step.
 *
 * An agreement cycle (propose → critique → converge → commit) is NOT
 * linear, it's a CYCLE: each iteration re-engages every agent, and
 * every agent can run multiple times. Rendering it in Delphi's default
 * linear waterfall loses that structure. This component reads the
 * `workflow_tasks` rows for a given step (each row = one LLM call,
 * with `payload.role`, `payload.turn`, etc.) and renders them
 * radially:
 *
 *   - Central circle: the step, with the total iteration count inside.
 *   - Rim nodes: one per unique agent; rotated around the circle.
 *   - Per-agent turn pips: concentric rings moving outward per turn,
 *     colored by outcome (approve=green, refine=amber, reject=red).
 *   - Click any pip → inspector reveals the row's payload + result
 *     (rubric scores, tokens, model, confidence).
 *
 * Domain-agnostic: the same component renders a plan-gate cycle, a
 * content-moderation cycle, an order-review cycle, etc. — anything
 * whose tasks carry `payload.kind === 'llm_call'` with role + turn.
 */

import { useMemo, useState } from 'react'
import type { WorkflowTask } from '@/api/types'

interface AgreementAgent {
  id: string
  role: string
  model?: string
  callsByTurn: Map<number, WorkflowTask>
}

interface AgreementData {
  agents: AgreementAgent[]
  maxTurn: number
  totalCalls: number
}

function buildAgreementData(tasks: WorkflowTask[]): AgreementData | null {
  const llmTasks = tasks.filter(
    t =>
      t.payload &&
      typeof t.payload === 'object' &&
      (t.payload as Record<string, unknown>).kind === 'llm_call',
  )
  if (llmTasks.length === 0) return null

  const byAgent = new Map<string, AgreementAgent>()
  let maxTurn = 1
  for (const task of llmTasks) {
    const p = task.payload as Record<string, unknown>
    const agentId = (p.agent as string) ?? 'unknown'
    const role = (p.role as string) ?? 'unknown'
    const model = p.model as string | undefined
    const turn = Number(p.turn ?? 1)
    if (turn > maxTurn) maxTurn = turn
    let agent = byAgent.get(agentId)
    if (!agent) {
      agent = { id: agentId, role, model, callsByTurn: new Map() }
      byAgent.set(agentId, agent)
    }
    agent.callsByTurn.set(turn, task)
  }

  // Stable display order: proposer first, then reviewers, then arbiters.
  const roleRank: Record<string, number> = {
    proposer: 0,
    refiner: 0,
    reviewer: 1,
    arbiter: 2,
  }
  const agents = Array.from(byAgent.values()).sort(
    (a, b) => (roleRank[a.role] ?? 99) - (roleRank[b.role] ?? 99),
  )
  return { agents, maxTurn, totalCalls: llmTasks.length }
}

// ── Colour mapping ─────────────────────────────────────────────────

function pipColor(task: WorkflowTask): string {
  if (task.status === 'failed') return 'var(--color-status-failed, #ef4444)'
  if (task.status !== 'completed') return 'var(--color-status-pending, #9ca3af)'
  const assessment = (task.result as Record<string, unknown> | null)
    ?.overallAssessment as string | undefined
  if (assessment === 'approve')
    return 'var(--color-status-completed, #10b981)'
  if (assessment === 'reject') return 'var(--color-status-failed, #ef4444)'
  if (assessment === 'refine') return 'var(--color-status-refine, #f59e0b)'
  // Proposer has no assessment — neutral
  return 'var(--color-accent, #6366f1)'
}

function roleGlyph(role: string): string {
  switch (role) {
    case 'proposer':
      return '\u2728' // sparkles
    case 'refiner':
      return '\u21BB' // clockwise arrow
    case 'reviewer':
      return '\uD83D\uDD0D' // magnifying glass
    case 'arbiter':
      return '\u2696\uFE0F' // scales
    default:
      return '\u2022'
  }
}

// ── Layout ─────────────────────────────────────────────────────────

const SIZE = 420
const CENTER = SIZE / 2
const CENTER_RADIUS = 46
const RIM_RADIUS = SIZE / 2 - 64 // leaves room for labels
const PIP_SPACING = 14

// ── Component ──────────────────────────────────────────────────────

export function AgreementCycle({
  tasks,
  stepName,
  onSelectTask,
}: {
  tasks: WorkflowTask[]
  stepName?: string
  onSelectTask?: (task: WorkflowTask) => void
}) {
  const data = useMemo(() => buildAgreementData(tasks), [tasks])
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  if (!data) {
    return (
      <div className="text-sm text-[var(--color-text-muted,#6b7280)] p-4">
        No agreement data found for this step.
      </div>
    )
  }

  const selectedTask =
    tasks.find(t => t.id === (selectedTaskId ?? hoveredTaskId)) ?? null

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label="Agreement cycle radial visualisation"
        >
          {/* Center circle */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER_RADIUS}
            fill="var(--color-surface-1, #1f2937)"
            stroke="var(--color-surface-2, #374151)"
            strokeWidth={2}
          />
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor="middle"
            className="fill-[var(--color-text-primary,#e5e7eb)]"
            fontSize={24}
            fontWeight={600}
          >
            {data.maxTurn}
          </text>
          <text
            x={CENTER}
            y={CENTER + 14}
            textAnchor="middle"
            className="fill-[var(--color-text-muted,#9ca3af)]"
            fontSize={10}
          >
            {data.maxTurn === 1 ? 'iteration' : 'iterations'}
          </text>

          {/* Rim agent nodes */}
          {data.agents.map((agent, idx) => {
            const angle =
              -Math.PI / 2 + (2 * Math.PI * idx) / data.agents.length
            const cx = CENTER + RIM_RADIUS * Math.cos(angle)
            const cy = CENTER + RIM_RADIUS * Math.sin(angle)
            const labelX =
              CENTER + (RIM_RADIUS + 36) * Math.cos(angle)
            const labelY =
              CENTER + (RIM_RADIUS + 36) * Math.sin(angle)
            const labelAnchor: 'start' | 'middle' | 'end' =
              Math.cos(angle) > 0.3
                ? 'start'
                : Math.cos(angle) < -0.3
                  ? 'end'
                  : 'middle'

            return (
              <g key={agent.id}>
                {/* Connection line: center → agent node */}
                <line
                  x1={
                    CENTER +
                    CENTER_RADIUS * Math.cos(angle)
                  }
                  y1={
                    CENTER +
                    CENTER_RADIUS * Math.sin(angle)
                  }
                  x2={cx}
                  y2={cy}
                  stroke="var(--color-surface-2, #374151)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />

                {/* Agent hub */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={18}
                  fill="var(--color-surface-2, #374151)"
                  stroke="var(--color-surface-3, #4b5563)"
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  fontSize={16}
                >
                  {roleGlyph(agent.role)}
                </text>

                {/* Turn pips — radially inward from the agent hub */}
                {Array.from(agent.callsByTurn.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([turn, task], i) => {
                    const pipDist = 18 + PIP_SPACING + i * PIP_SPACING
                    const pipX = cx - pipDist * Math.cos(angle)
                    const pipY = cy - pipDist * Math.sin(angle)
                    const isActive =
                      hoveredTaskId === task.id || selectedTaskId === task.id
                    return (
                      <g
                        key={task.id}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                        onClick={() => {
                          setSelectedTaskId(task.id)
                          onSelectTask?.(task)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={pipX}
                          cy={pipY}
                          r={isActive ? 7 : 5}
                          fill={pipColor(task)}
                          stroke={
                            isActive
                              ? 'var(--color-text-primary,#e5e7eb)'
                              : 'var(--color-surface-0,#111827)'
                          }
                          strokeWidth={isActive ? 2 : 1}
                        />
                        <text
                          x={pipX}
                          y={pipY + 3}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight={600}
                          className="fill-[var(--color-surface-0,#111827)] pointer-events-none select-none"
                        >
                          {turn}
                        </text>
                      </g>
                    )
                  })}

                {/* Agent label */}
                <text
                  x={labelX}
                  y={labelY - 4}
                  textAnchor={labelAnchor}
                  fontSize={11}
                  fontWeight={600}
                  className="fill-[var(--color-text-primary,#e5e7eb)]"
                >
                  {agent.role}
                </text>
                <text
                  x={labelX}
                  y={labelY + 8}
                  textAnchor={labelAnchor}
                  fontSize={9}
                  className="fill-[var(--color-text-muted,#9ca3af)]"
                >
                  {agent.model ?? agent.id}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-0 left-0 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-muted,#9ca3af)]">
          <LegendSwatch color="var(--color-status-completed, #10b981)" label="approve" />
          <LegendSwatch color="var(--color-status-refine, #f59e0b)" label="refine" />
          <LegendSwatch color="var(--color-status-failed, #ef4444)" label="reject / fail" />
          <LegendSwatch color="var(--color-accent, #6366f1)" label="proposer" />
        </div>
      </div>

      {/* Inspector panel */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted,#9ca3af)] mb-2">
          {stepName ? `${stepName} · ` : ''}
          {selectedTask ? 'Selected call' : 'Hover a pip to inspect'}
        </h4>
        {selectedTask && <TaskInspector task={selectedTask} />}
        {!selectedTask && (
          <SummaryFacts
            agents={data.agents}
            totalCalls={data.totalCalls}
            maxTurn={data.maxTurn}
          />
        )}
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block rounded-full"
        style={{ width: 8, height: 8, background: color }}
      />
      <span>{label}</span>
    </span>
  )
}

function SummaryFacts({
  agents,
  totalCalls,
  maxTurn,
}: {
  agents: AgreementAgent[]
  totalCalls: number
  maxTurn: number
}) {
  return (
    <dl className="text-sm space-y-1 text-[var(--color-text-secondary,#d1d5db)]">
      <div className="flex justify-between">
        <dt className="text-[var(--color-text-muted,#9ca3af)]">Agents</dt>
        <dd>{agents.length}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-[var(--color-text-muted,#9ca3af)]">Iterations</dt>
        <dd>{maxTurn}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-[var(--color-text-muted,#9ca3af)]">LLM calls</dt>
        <dd>{totalCalls}</dd>
      </div>
    </dl>
  )
}

function TaskInspector({ task }: { task: WorkflowTask }) {
  const payload = (task.payload ?? {}) as Record<string, unknown>
  const result = (task.result ?? {}) as Record<string, unknown>
  const rubric = result.rubric as
    | Record<string, { score: number; evidence?: string }>
    | undefined
  return (
    <div className="rounded-md bg-[var(--color-surface-1,#1f2937)] p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{roleGlyph(String(payload.role ?? ''))}</span>
        <span className="font-semibold text-[var(--color-text-primary,#e5e7eb)]">
          {String(payload.role ?? 'unknown')}
          {payload.reviewer ? ` · ${payload.reviewer}` : ''}
        </span>
        <span className="ml-auto text-[var(--color-text-muted,#9ca3af)]">
          turn {String(payload.turn ?? '?')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-[var(--color-text-muted,#9ca3af)]">
        {Boolean(payload.model) && <span>model: {String(payload.model)}</span>}
        {typeof result.tokensUsed === 'number' && (
          <span>tokens: {result.tokensUsed}</span>
        )}
        {typeof result.costUsd === 'number' && (
          <span>${(result.costUsd as number).toFixed(4)}</span>
        )}
        {typeof result.overallAssessment === 'string' && (
          <span>· {String(result.overallAssessment)}</span>
        )}
        {typeof result.confidence === 'number' && (
          <span>conf {(result.confidence as number).toFixed(2)}</span>
        )}
      </div>
      {rubric && (
        <div className="space-y-1">
          {Object.entries(rubric).map(([criterion, r]) => (
            <div key={criterion} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[var(--color-text-muted,#9ca3af)]">
                {criterion}
              </span>
              <div className="flex-1 h-2 bg-[var(--color-surface-2,#374151)] rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${(r.score / 5) * 100}%`,
                    background: 'var(--color-accent, #6366f1)',
                  }}
                />
              </div>
              <span className="w-6 text-right text-[var(--color-text-primary,#e5e7eb)]">
                {r.score}/5
              </span>
            </div>
          ))}
        </div>
      )}
      {task.error && (
        <pre className="rounded bg-red-950/40 border border-red-800/40 text-red-200 p-2 overflow-x-auto">
          {task.error}
        </pre>
      )}
    </div>
  )
}
