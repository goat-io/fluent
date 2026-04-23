import type {
  AggregateMetrics,
  QueueStats,
  StepLog,
  WorkerNodeInfo,
  WorkflowFilters,
  WorkflowRunDetail,
  WorkflowRunMetrics,
  WorkflowRunSummary,
  WorkflowTask,
} from './types'

export class AgentsClient {
  private baseUrl: string
  private tenantId: string
  private headers: Record<string, string>

  constructor(config: {
    baseUrl: string
    tenantId: string
    authToken?: string
    extraHeaders?: Record<string, string>
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.tenantId = config.tenantId
    this.headers = {
      'Content-Type': 'application/json',
      ...(config.authToken
        ? { Authorization: `Bearer ${config.authToken}` }
        : {}),
      ...config.extraHeaders,
    }
  }

  // ── Workflows ──────────────────────────────────────

  async listWorkflows(
    filters?: WorkflowFilters,
  ): Promise<WorkflowRunSummary[]> {
    const params = new URLSearchParams()
    if (filters?.status) {
      params.set('status', filters.status.join(','))
    }
    if (filters?.workflowName) {
      params.set('workflowName', filters.workflowName)
    }
    if (filters?.limit) {
      params.set('limit', String(filters.limit))
    }
    if (filters?.offset) {
      params.set('offset', String(filters.offset))
    }
    return this.get(`/workflows?${params}`)
  }

  async getWorkflow(runId: string): Promise<WorkflowRunDetail> {
    return this.post('/workflows/status', { runId, tenantId: this.tenantId })
  }

  async listDefinitions(): Promise<
    Array<{ name: string; version: string; stepCount: number }>
  > {
    return this.get('/workflows/definitions')
  }

  async getDefinition(workflowName: string): Promise<{
    name: string
    version: string
    steps: Array<{ name: string; executorType: string; dependsOn?: string[] }>
    inputFields: Array<{ name: string; source: string }>
  }> {
    return this.post('/workflows/definition', { workflowName })
  }

  async startWorkflow(
    workflowName: string,
    input: Record<string, unknown>,
  ): Promise<{ runId: string }> {
    return this.post('/workflows/start', {
      workflowName,
      tenantId: this.tenantId,
      input,
    })
  }

  async cancelWorkflow(runId: string): Promise<void> {
    await this.post('/workflows/cancel', { runId, tenantId: this.tenantId })
  }

  async retryWorkflow(
    runId: string,
  ): Promise<{ success: true; runId: string }> {
    return this.post('/workflows/retry', { runId, tenantId: this.tenantId })
  }

  async cancelAllWorkflows(
    workflowName: string,
    status: string[],
  ): Promise<{ cancelled: number }> {
    return this.post('/workflows/cancel-all', {
      workflowName,
      status,
      tenantId: this.tenantId,
    })
  }

  async retryAllWorkflows(
    workflowName: string,
    status: string[],
  ): Promise<{ retried: number }> {
    return this.post('/workflows/retry-all', {
      workflowName,
      status,
      tenantId: this.tenantId,
    })
  }

  // ── Steps ──────────────────────────────────────────

  async getStepLogs(runId: string, stepName: string): Promise<StepLog[]> {
    return this.post('/workflows/step-logs', {
      runId,
      stepName,
      tenantId: this.tenantId,
    })
  }

  /**
   * List `workflow_tasks` for a run, optionally scoped to one step.
   * Each row is a fan-out unit of work (e.g. one LLM call in an
   * agreement cycle). Powers the <AgreementCycle> visualisation.
   */
  async getStepTasks(
    runId: string,
    stepName?: string,
  ): Promise<WorkflowTask[]> {
    return this.post('/workflows/tasks', {
      runId,
      stepName,
      tenantId: this.tenantId,
    })
  }

  // ── Human-in-the-loop ──────────────────────────────

  async submitHumanInput(
    runId: string,
    stepName: string,
    data: Record<string, unknown>,
    respondedBy?: string,
  ): Promise<void> {
    await this.post('/workflows/human-input', {
      workflowRunId: runId,
      stepName,
      tenantId: this.tenantId,
      data,
      respondedBy,
    })
  }

  // ── Signals & Queries ──────────────────────────────

  async sendSignal(
    runId: string,
    signalName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.post('/workflows/signal', {
      runId,
      tenantId: this.tenantId,
      signalName,
      data,
    })
  }

  async query(
    runId: string,
    queryName: string,
  ): Promise<Record<string, unknown>> {
    return this.post('/workflows/query', {
      runId,
      tenantId: this.tenantId,
      queryName,
    })
  }

  // ── Metrics ────────────────────────────────────────

  async getRunMetrics(runId: string): Promise<WorkflowRunMetrics | null> {
    return this.post('/workflows/metrics', { runId })
  }

  async getAggregateMetrics(opts?: {
    since?: string
    workflowName?: string
  }): Promise<AggregateMetrics> {
    return this.post('/workflows/aggregate-metrics', {
      tenantId: this.tenantId,
      ...opts,
    })
  }

  // ── Workers & Queues ───────────────────────────────

  async getQueueStats(): Promise<QueueStats[]> {
    return this.get('/queues')
  }

  async listWorkers(): Promise<WorkerNodeInfo[]> {
    return this.post('/workers/list', { tenantId: this.tenantId })
  }

  async updateWorkerQueues(workerId: string, queues: string[]): Promise<void> {
    await this.post('/workers/update-queues', { workerId, queues })
  }

  async generateWorkerToken(): Promise<{
    token: string
    installCommand: string
    startCommand: string
    lanCommand?: string
  }> {
    return this.post('/workers/generate-token', { tenantId: this.tenantId })
  }

  // ── Schedules ──────────────────────────────────────

  async listSchedules(): Promise<import('./types').WorkflowSchedule[]> {
    return this.post('/schedules/list', { tenantId: this.tenantId })
  }

  async createSchedule(
    workflowName: string,
    cronExpression: string,
  ): Promise<{ scheduleId: string }> {
    return this.post('/schedules/create', {
      tenantId: this.tenantId,
      workflowName,
      cronExpression,
    })
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.post('/schedules/delete', { scheduleId })
  }

  // ── Events ────────────────────────────────────────

  async ingestEvent(
    eventType: string,
    source: string,
    payload: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<{ eventId: string; duplicate: boolean }> {
    return this.post('/workflows/ingest-event', {
      tenantId: this.tenantId,
      eventType,
      source,
      payload,
      idempotencyKey,
    })
  }

  // ── Trace ─────────────────────────────────────────

  async getTrace(traceId: string): Promise<import('./types').TraceLineage> {
    return this.post('/workflows/trace', { traceId })
  }

  // ── Real-time ──────────────────────────────────────

  subscribe(runId: string): EventSource {
    const url = `${this.baseUrl}/workflows/subscribe?runId=${runId}&tenantId=${this.tenantId}`
    return new EventSource(url)
  }

  subscribeWorkers(): EventSource {
    const url = `${this.baseUrl}/workers/subscribe?tenantId=${this.tenantId}`
    return new EventSource(url)
  }

  // ── Internal ───────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers })
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`)
    }
    return res.json()
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`)
    }
    return res.json()
  }
}
