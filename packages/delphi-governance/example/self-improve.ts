// Delphi self-hosting loop — run with: pnpm example:self-improve
// (Requires Docker. Spins a throwaway Postgres unless DATABASE_URL is set.)
//
// Demonstrates the full governance loop running ON THIS REPO:
//   Observe   — scan the delphi-* packages (self-knowledge)
//   Review    — perspective review of the "self-document & assess" decision
//   Execute   — compile each Action into a real delphi-core workflow run
//   Measure   — record an Outcome per run back to the Brain
//   Document  — the workflows WRITE generated docs + assessments to disk
//
// i.e. Delphi self-assesses, self-documents, and records what it learned.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  createDbClient,
  CREATE_TABLES_SQL,
  createEngine,
  FunctionStep,
  runMigrations,
  type StepPayload,
  Workflow,
  WorkflowStepTask,
} from '@goatlab/delphi-core'
import {
  type ChatLike,
  claudeCodeAvailable,
  CompileRegistry,
  createClaudeCodeChat,
  createGovernance,
  createLLMPerspectiveEvaluator,
  fromEngine,
  type Governance,
  heuristicPerspectiveEvaluator,
  InMemoryBrainClient,
  type PerspectiveEvaluator,
  STANDARD_PERSPECTIVES,
} from '../src/index.js'
import type { Action, Decision } from '../src/index.js'
import { getPostgres } from './pg.js'

const TENANT = 'delphi'
// Portable __dirname (works under tsx's CJS transform and native ESM).
const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES_DIR = join(HERE, '..', '..')
const OUT_DIR = join(HERE, 'output')

// ── Self-knowledge helpers ──────────────────────────────────────────
function countFiles(dir: string, ext: string): number {
  let n = 0
  const walk = (d: string) => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue
      const p = join(d, e)
      const s = statSync(p)
      if (s.isDirectory()) walk(p)
      else if (e.endsWith(ext)) n++
    }
  }
  walk(dir)
  return n
}

function readPkg(dir: string): { name?: string; version?: string; description?: string } {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return {}
  }
}

function exists(p: string): boolean {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

// ── Workflows (the execution plane does REAL analysis on this repo) ──

interface PkgInput {
  packageDir: string
  name: string
  [k: string]: unknown
}

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…[truncated]` : s)
const stripFences = (s: string) =>
  s.trim().replace(/^```(?:markdown|md)?\n?/i, '').replace(/\n?```$/i, '').trim()

function frontmatter(fields: Record<string, string>): string {
  return ['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), '---', ''].join('\n')
}

/** Bounded, information-rich context for one package: pkg meta + README + exports + file tree. */
function gatherContext(dir: string, name: string): string {
  const pkg = readPkg(dir) as Record<string, unknown>
  const readme = exists(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '(no README)'
  const indexPath = ['src/index.ts', 'src/index.tsx', 'index.ts'].map(p => join(dir, p)).find(exists)
  const index = indexPath ? readFileSync(indexPath, 'utf8') : '(no index entrypoint)'
  const srcFiles: string[] = []
  const walk = (d: string, base = '') => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue
      const p = join(d, e)
      const rel = base ? `${base}/${e}` : e
      if (statSync(p).isDirectory()) walk(p, rel)
      else if (/\.(ts|tsx|go)$/.test(e)) srcFiles.push(rel)
    }
  }
  walk(join(dir, 'src'))
  const deps = Object.keys({
    ...(pkg.dependencies as object),
    ...(pkg.peerDependencies as object),
  })
  return [
    `PACKAGE: ${pkg.name ?? name}  (v${pkg.version ?? '?'})`,
    `DESCRIPTION: ${pkg.description ?? '(none)'}`,
    deps.length ? `DEPENDENCIES: ${deps.join(', ')}` : '',
    '',
    '=== README ===',
    cap(readme, 6000),
    '',
    '=== ENTRYPOINT (exports) ===',
    cap(index, 5000),
    '',
    `=== SOURCE FILES (${srcFiles.length}) ===`,
    cap(srcFiles.join('\n'), 2500),
  ]
    .filter(Boolean)
    .join('\n')
}

/** Writes a real architectural narrative by analysing the package with claude -p. */
class DocumentPackageStep extends FunctionStep<PkgInput, { docPath: string; mode: string }> {
  stepName = 'document_package' as const
  constructor(private chat: ChatLike | null) {
    super()
  }
  async handle(input: PkgInput) {
    const ctx = gatherContext(input.packageDir, input.name)
    const pkg = readPkg(input.packageDir)
    let body: string
    let mode: string
    if (this.chat) {
      const sys =
        'You are a staff engineer writing a precise architectural narrative for an internal knowledge base. Use ONLY the provided context. Be concrete: name real exports, modules, and patterns. No filler, no marketing. Output GitHub-flavored markdown with these sections: ## Purpose, ## Key modules & exports, ## How it fits the monorepo, ## Notable patterns, ## Caveats / gaps. ~250-450 words. Do NOT include a top-level H1 or frontmatter.'
      try {
        const { content } = await this.chat([
          { role: 'system', content: sys },
          { role: 'user', content: ctx },
        ])
        body = stripFences(content)
        mode = 'claude'
      } catch (err) {
        body = `## Purpose\n${pkg.description ?? input.name}\n\n_(claude analysis failed: ${(err as Error).message.slice(0, 100)} — template fallback)_`
        mode = 'error-fallback'
      }
    } else {
      body = `## Purpose\n${pkg.description ?? 'n/a'}\n\n_(offline mode — install/authenticate the claude CLI for a full analysis)_`
      mode = 'fallback'
    }
    const md = `${frontmatter({
      name: input.name,
      description: (pkg.description ?? input.name).replace(/\n/g, ' '),
      kind: 'narrative',
      'last-updated': new Date().toISOString().slice(0, 10),
      owner: 'delphi-self',
      status: 'generated',
    })}# ${pkg.name ?? input.name}\n\n${body}\n`
    mkdirSync(join(OUT_DIR, 'narratives'), { recursive: true })
    const docPath = join(OUT_DIR, 'narratives', `${input.name}.md`)
    writeFileSync(docPath, md)
    return { output: { docPath, mode } }
  }
}

class DocumentPackageWorkflow extends Workflow<PkgInput> {
  workflowName = 'documentPackage' as const
  steps: readonly [DocumentPackageStep]
  constructor(chat: ChatLike | null) {
    super()
    this.steps = [new DocumentPackageStep(chat)]
  }
}

/** Writes a genuine engineering assessment (strengths, risks, justified score) via claude -p. */
class AssessPackageStep extends FunctionStep<PkgInput, { score: number; mode: string }> {
  stepName = 'assess_package' as const
  constructor(private chat: ChatLike | null) {
    super()
  }
  async handle(input: PkgInput) {
    const ctx = gatherContext(input.packageDir, input.name)
    const tests = countFiles(input.packageDir, '.spec.ts') + countFiles(input.packageDir, '.test.ts')
    const pkg = readPkg(input.packageDir)
    let body: string
    let score: number
    let mode: string
    if (this.chat) {
      const sys = `You are a critical staff engineer running an internal health audit. Use ONLY the provided context (plus: ${tests} test files were found in the package). Be honest and specific — do NOT inflate scores. Output markdown with: ## Strengths, ## Gaps & risks (specific and actionable), ## Test coverage (judge the ${tests} test files against the surface area), ## Verdict. End with a final line EXACTLY like "SCORE: <0-100>" reflecting real engineering health (most real packages land 55-85; reserve 90+ for exceptional). No frontmatter, no H1.`
      try {
        const { content } = await this.chat([
          { role: 'system', content: sys },
          { role: 'user', content: ctx },
        ])
        const raw = stripFences(content)
        const m = raw.match(/SCORE:\s*(\d{1,3})/i)
        score = m ? Math.max(0, Math.min(100, Number(m[1]))) : 0
        body = raw.replace(/SCORE:\s*\d{1,3}/i, '').trim()
        mode = 'claude'
      } catch (err) {
        const present = ['README.md', 'package.json', 'src', 'tsconfig.json'].filter(f => exists(join(input.packageDir, f)))
        score = Math.round(((present.length + (tests > 0 ? 1 : 0)) / 5) * 100)
        body = `_(claude analysis failed: ${(err as Error).message.slice(0, 100)} — heuristic fallback)_ present: ${present.join(', ')}; test files: ${tests}.`
        mode = 'error-fallback'
      }
    } else {
      const present = ['README.md', 'package.json', 'src', 'tsconfig.json'].filter(f => exists(join(input.packageDir, f)))
      score = Math.round(((present.length + (tests > 0 ? 1 : 0)) / 5) * 100)
      body = `_(offline mode)_ present: ${present.join(', ')}; test files: ${tests}.`
      mode = 'fallback'
    }
    const md = `${frontmatter({
      name: `assessment-${input.name}`,
      description: `Health assessment of ${input.name}`,
      kind: 'narrative',
      'last-updated': new Date().toISOString().slice(0, 10),
      owner: 'delphi-self',
      status: 'generated',
    })}# Assessment: ${pkg.name ?? input.name}\n\n**Health score: ${score}/100**\n\n${body}\n`
    mkdirSync(join(OUT_DIR, 'assessments'), { recursive: true })
    writeFileSync(join(OUT_DIR, 'assessments', `${input.name}.md`), md)
    return { output: { score, mode } }
  }
}

class AssessPackageWorkflow extends Workflow<PkgInput> {
  workflowName = 'assessPackage' as const
  steps: readonly [AssessPackageStep]
  constructor(chat: ChatLike | null) {
    super()
    this.steps = [new AssessPackageStep(chat)]
  }
}

// ── Main loop ───────────────────────────────────────────────────────

async function main() {
  console.log('\n🧠  Delphi self-hosting loop — running on this repo\n')

  // OBSERVE — discover the delphi-* packages (the company looking at itself).
  const pkgDirs = readdirSync(PACKAGES_DIR)
    .filter(d => d.startsWith('delphi-'))
    .map(d => join(PACKAGES_DIR, d))
    .filter(d => exists(join(d, 'package.json')))
  console.log(`  Observed ${pkgDirs.length} delphi packages: ${pkgDirs.map(d => basename(d)).join(', ')}\n`)

  // Seed the Brain (judgment plane): one decision + a document/assess action per package.
  const decision: Decision = {
    name: 'self-document-and-assess-delphi',
    kind: 'decision',
    description: 'Continuously document and assess every Delphi package so the system understands itself.',
    status: 'approved',
    choice: 'Generate a narrative doc and a health assessment for each package.',
  }
  const actions: Action[] = pkgDirs.flatMap(dir => {
    const name = basename(dir)
    return [
      { name: `document-${name}`, kind: 'action', description: `Document ${name}`, type: 'document', status: 'proposed', target: dir },
      { name: `assess-${name}`, kind: 'action', description: `Assess ${name}`, type: 'assess', status: 'proposed', target: dir },
    ]
  })
  const brain = new InMemoryBrainClient({ actions, decisions: [decision] })

  // Bring up the execution plane (delphi-core on Postgres).
  const { connectionString, stop: stopPg } = await getPostgres()
  const pgPool = new pg.Pool({ connectionString, max: 8 })
  const db = createDbClient(pgPool)
  console.log('  Creating schema ...')
  for (const stmt of CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
    await pgPool.query(stmt)
  }
  await runMigrations(db)

  // Real reasoning via `claude -p` (Claude subscription, NO API key) drives both
  // the perspective review AND the documentation/assessment workflows. Falls back
  // to offline mode if the CLI is absent or DELPHI_HEURISTIC=1.
  const claudeOn = claudeCodeAvailable() && !process.env.DELPHI_HEURISTIC
  const model = process.env.DELPHI_MODEL ?? 'sonnet'
  const analysisChat: ChatLike | null = claudeOn ? createClaudeCodeChat({ model, timeoutMs: 180_000 }) : null
  console.log(`  Analysis mode: ${claudeOn ? `claude -p (${model}, no API key)` : 'offline fallback'}\n`)

  let governance: Governance
  const engine = createEngine({
    workflows: [
      new DocumentPackageWorkflow(analysisChat),
      new AssessPackageWorkflow(analysisChat),
    ] as const,
    database: pgPool,
    tenantId: TENANT,
    dispatch: { pollingIntervalMs: 50 },
    onEngineEvent: evt => governance?.onEngineEvent(evt),
  })

  // Start a worker so enqueued steps actually run. In Postgres-only mode the
  // PgConnector claims steps from workflow_steps and routes them all to the
  // first registered handler — so a single step handler is exactly right (the
  // IngestWorker/ingest queue is only for the BullMQ buffered path).
  const connector = engine.connector
  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)
  const stepHandle = (data: unknown) => stepTask.handle(data as StepPayload)
  // Each step may spawn a `claude -p` subprocess. Concurrency is tunable via
  // DELPHI_CONCURRENCY (default 5) to balance throughput vs. CLI/rate limits.
  const concurrency = Number(process.env.DELPHI_CONCURRENCY ?? 5)
  const workerHandle = await connector.listen({
    tasks: [{ taskName: 'workflow_step', handle: stepHandle, concurrency }],
    defaultConcurrency: concurrency,
  })

  // Wire governance: review (heuristic, offline) + compile registry + measure.
  const registry = new CompileRegistry()
    .register('document', { workflowName: 'documentPackage', mapInput: a => ({ packageDir: a.target as string, name: basename(a.target as string) }) })
    .register('assess', { workflowName: 'assessPackage', mapInput: a => ({ packageDir: a.target as string, name: basename(a.target as string) }) })

  // Review reuses the same claude -p chat (or the offline heuristic).
  const evaluator: PerspectiveEvaluator = analysisChat
    ? createLLMPerspectiveEvaluator(analysisChat)
    : heuristicPerspectiveEvaluator()

  governance = createGovernance({
    brain,
    starter: fromEngine(engine as unknown as Record<string, unknown>),
    registry,
    review: { evaluator },
  })

  // REVIEW — perspectives weigh in on the decision (tradeoffs, not consensus).
  console.log('  ── Review (perspectives) ──')
  const review = await governance.reviewDecision(decision, STANDARD_PERSPECTIVES)
  for (const v of review.matrix.verdicts) {
    console.log(`    ${v.perspective.padEnd(12)} ${v.assessment}${v.concerns[0] ? `  (${v.concerns[0]})` : ''}`)
  }
  console.log(`    → outcome: ${review.outcome} (score ${review.score.toFixed(2)})\n`)
  if (review.outcome === 'rejected') {
    console.log('  Decision rejected by review — stopping.')
    teardown()
  }
  if (review.outcome === 'needs_human') {
    console.log('  ⚠️  Review escalated to a human (constitution gate). Proceeding anyway for the demo.\n')
  }

  // EXECUTE — compile each approved action into an exactly-once workflow run.
  console.log('  ── Execute (compile decisions → workflows) ──')
  const results = await governance.tick()
  const executing = results.filter(r => r.status === 'executing')
  for (const r of results) {
    console.log(`    ${r.item.padEnd(34)} ${r.status}${r.runId ? `  run=${r.runId.slice(0, 8)}` : ''}`)
  }
  console.log(`    started ${executing.length} runs\n`)

  // MEASURE — wait for outcomes to land (run.completed → recorded back to Brain).
  console.log('  ── Measure (await outcomes) ──')
  // Real claude -p analysis takes ~20-40s per package; allow the fleet to drain.
  const deadline = Date.now() + 600_000
  while (brain.outcomes.length < executing.length && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200))
  }
  const completed = brain.outcomes.filter(o => o.status === 'COMPLETED').length
  console.log(`    ${brain.outcomes.length}/${executing.length} outcomes recorded (${completed} COMPLETED)\n`)

  // LEARN — write a loop record (self-evolution trace).
  mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString()
  const log = [
    `## [${stamp}] self-document-and-assess-delphi`,
    `- review: ${review.outcome} (score ${review.score.toFixed(2)})`,
    `- actions executed: ${executing.length}`,
    `- outcomes: ${brain.outcomes.length} (${completed} completed)`,
    ...brain.outcomes.map(o => `  - ${o.itemName}: ${o.status}`),
    '',
  ].join('\n')
  writeFileSync(join(OUT_DIR, 'log.md'), log)
  console.log(`  📝 wrote generated docs + assessments + log to:\n     ${OUT_DIR}\n`)

  // CONNECT BRAIN — ingest the self-generated docs into the Delphi Brain so
  // institutional memory grows and becomes queryable. This closes the loop:
  // Delphi documented itself → the Brain now knows about its own packages.
  console.log('  ── Connect Brain (index self-docs into institutional memory) ──')
  try {
    const brainBin = join(HERE, '..', '..', 'delphi-brain', 'cli', 'brain')
    if (!exists(brainBin)) {
      throw new Error('brain binary not built — run: cd packages/delphi-brain && make build')
    }
    writeFileSync(
      join(OUT_DIR, 'brain.config.json'),
      JSON.stringify(
        { org: { name: 'Goat Fluent / Delphi', description: 'The Delphi agent OS monorepo, documenting itself.' } },
        null,
        2,
      ),
    )
    const env = {
      ...process.env,
      BRAIN_ROOT: OUT_DIR,
      BRAIN_DB: join(OUT_DIR, 'brain.db'),
      BRAIN_SCHEMA_DIR: join(HERE, '..', '..', 'delphi-brain', 'schema'),
    }
    const brain = (args: string[]) => execFileSync(brainBin, args, { env, encoding: 'utf8' }).trim()
    brain(['index', '--root', OUT_DIR])
    const docCount = brain(['query', 'SELECT count(*) AS documents FROM documents']).replace(/\s+/g, ' ')
    const sample = brain(['query', "SELECT path FROM documents WHERE path LIKE '%assessments%' LIMIT 3"])
    console.log(`    Brain indexed self-docs → ${docCount}`)
    console.log(`    now queryable, e.g. assessments:\n${sample.split('\n').map(l => `      ${l}`).join('\n')}`)
    console.log('    🧠 institutional memory updated — the Brain knows about its own packages.\n')
  } catch (err) {
    console.log(`    (skipped Brain indexing: ${(err as Error).message})\n`)
  }

  console.log('  ✅ self-hosting loop complete: reviewed → executed → documented → measured → learned → remembered.\n')

  teardown()

  function teardown(): never {
    // The engine + connector keep internal poll loops / timers running. Rather
    // than chase every one, stop the worker, drop the throwaway container, and
    // exit — the OS reclaims the pool + sockets immediately.
    void workerHandle.stop().catch(() => {})
    stopPg()
    process.exit(0)
  }
}

main().catch(err => {
  console.error('\n❌ self-improve failed:', err)
  process.exit(1)
})
