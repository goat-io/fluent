// Self-contained agent script generator.
// Returns a JS string that can be eval'd on any machine with Node 18+.
// No npm packages required — uses only Node built-ins (crypto, os, child_process, fetch).

export function generateAgentScript(
  brokerUrl: string,
  token: string,
  tenantId: string,
  queues?: string[],
  labels?: string[],
): string {
  return `
// Goat Agent — self-contained remote worker
// Connects to ${brokerUrl} via HTTPS only. No dependencies required.
const crypto = require('node:crypto');
const os = require('node:os');
const { execSync } = require('node:child_process');

const BROKER = ${JSON.stringify(brokerUrl)};
const TOKEN = ${JSON.stringify(token)};
const TENANT = ${JSON.stringify(tenantId)};
const FORCED_QUEUES = ${queues ? JSON.stringify(queues) : 'null'};  // null = auto-detect
// Labels the agent advertises for GitHub-Actions-style step routing.
// Step's requiresLabels must be a subset of these to get assigned.
// Operator-settable via the \`labels\` arg when generating the token,
// or at runtime via the AGENTS_LABELS env var (comma-separated).
const FORCED_LABELS = ${labels && labels.length > 0 ? JSON.stringify(labels) : 'null'};

let agentId = null;
const secret = crypto.randomBytes(32).toString('hex');
let running = true;
const activeJobs = new Map();
let pollAbort = null; // AbortController for current long-poll

async function post(path, body, signal) {
  const res = await fetch(BROKER + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(res.status + ' ' + res.statusText + ': ' + text);
  }
  return res.json();
}

function detectCapabilities() {
  const cpuCount = os.cpus().length;
  const memoryMB = Math.floor(os.totalmem() / (1024 * 1024));
  let dockerAvailable = false;
  try { execSync('docker info', { stdio: 'ignore', timeout: 5000 }); dockerAvailable = true; } catch {}
  let queues;
  if (FORCED_QUEUES) {
    queues = FORCED_QUEUES;
  } else {
    queues = ['workflow_step_light'];
    if (memoryMB >= 4096) queues.push('workflow_step_heavy');
    queues.push('workflow_step_ai');
    if (dockerAvailable) queues.push('workflow_step_sandbox');
  }
  // Label resolution: explicit list passed at token-gen time wins, then
  // AGENTS_LABELS env var (comma-separated), then a minimal default set
  // derived from detected capabilities (mirrors GitHub Actions'
  // automatic labels like self-hosted/linux/x64).
  let labels;
  if (FORCED_LABELS) {
    labels = FORCED_LABELS;
  } else if (process.env.AGENTS_LABELS) {
    labels = process.env.AGENTS_LABELS.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  } else {
    labels = ['self-hosted', process.platform, process.arch];
    if (dockerAvailable) labels.push('has-docker');
  }
  return { cpuCount, memoryMB, dockerAvailable, gpuAvailable: false, queues, labels };
}

async function executeJob(job) {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);
  try {
    await post('/agents/step-started', { agentId, secret, jobId: job.id });
    const payload = job.payload;
    let output;

    if (payload.executorType === 'claude_code') {
      // Run via claude -p CLI
      const config = payload.executorConfig || {};
      let prompt = config.prompt || '';
      if (!prompt && payload.input && payload.input.prompt) prompt = payload.input.prompt;
      if (prompt && payload.input) {
        prompt = prompt.replace(/\\{\\{input\\.(\\w+)\\}\\}/g, (_, field) => payload.input[field] !== undefined ? String(payload.input[field]) : '');
      }
      if (!prompt) prompt = JSON.stringify(payload.input || {});

      console.log('[agent] Running claude -p for step:', payload.stepName);
      const cliArgs = ['-p', prompt];
      if (config.appendSystemPrompt) cliArgs.push('--append-system-prompt', config.appendSystemPrompt);
      if (config.systemPrompt) cliArgs.push('--system-prompt', config.systemPrompt);
      if (config.model) cliArgs.push('--model', config.model);
      if (config.effort) cliArgs.push('--effort', config.effort);
      if (config.maxTurns) cliArgs.push('--max-turns', String(config.maxTurns));
      if (config.maxBudgetUsd) cliArgs.push('--max-budget-usd', String(config.maxBudgetUsd));
      if (config.permissionMode) cliArgs.push('--permission-mode', config.permissionMode);
      if (config.outputFormat === 'json') cliArgs.push('--output-format', 'json');
      if (config.allowedTools && config.allowedTools.length) cliArgs.push('--allowedTools', config.allowedTools.join(' '));
      if (config.addDirs && config.addDirs.length) {
        for (const dir of config.addDirs) cliArgs.push('--add-dir', dir);
      }
      if (config.cwd) cliArgs.push('--add-dir', config.cwd);

      // Use spawnSync with args array — avoids shell escaping issues
      const { spawnSync } = require('node:child_process');
      const proc = spawnSync('claude', cliArgs, {
        encoding: 'utf-8',
        timeout: config.timeoutMs || 300000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (proc.error) throw proc.error;
      if (proc.status !== 0 && !proc.stdout) {
        throw new Error(proc.stderr || 'Claude exited with code ' + proc.status);
      }
      const result = proc.stdout || '';

      if (config.outputFormat === 'json') {
        try { output = { result: JSON.parse(result) }; } catch { output = { result: result.trim() }; }
      } else {
        output = { result: result.trim() };
      }
      console.log('[agent] Claude response:', (output.result || '').substring(0, 200) + '...');
    } else {
      // Generic executor
      output = { executed: true, step: payload.stepName, type: payload.executorType, input: payload.input };
    }

    if (controller.signal.aborted) return;
    // Retry result submission up to 3 times (handles transient fetch failures)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await post('/agents/step-result', { agentId, secret, jobId: job.id, result: { output } });
        console.log('[agent] Job', job.id, 'completed');
        break;
      } catch (postErr) {
        if (attempt < 2) {
          console.log('[agent] Result POST failed, retrying in 2s...', postErr.message);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw postErr;
        }
      }
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    // Retry failure report too
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await post('/agents/step-failed', { agentId, secret, jobId: job.id, error: err.message }); break; } catch { if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    console.error('[agent] Job', job.id, 'failed:', err.message);
  } finally {
    activeJobs.delete(job.id);
  }
}

async function pollLoop() {
  let backoff = 1000;
  while (running) {
    if (activeJobs.size >= 5) { await new Promise(r => setTimeout(r, 100)); continue; }
    try {
      pollAbort = new AbortController();
      const res = await post('/agents/next-job', { agentId, secret, timeoutMs: 30000 }, pollAbort.signal);
      pollAbort = null;
      if (res.job) {
        backoff = 1000;
        executeJob(res.job).catch(e => console.error('[agent] exec error:', e.message));
      }
    } catch (err) {
      pollAbort = null;
      if (!running) break;
      if (err.name === 'AbortError') break;
      // Re-register if backend restarted and forgot us
      if (err.message && (err.message.includes('Unknown agent') || err.message.includes('Invalid agent'))) {
        console.log('[agent] Lost registration — re-registering...');
        try { await register(); console.log('[agent] Re-registered. Resuming...'); backoff = 1000; continue; } catch {}
      }
      console.error('[agent] Poll error:', err.message, '- retrying in', backoff + 'ms');
      await new Promise(r => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30000);
    }
  }
}

async function heartbeatLoop() {
  while (running) {
    await new Promise(r => setTimeout(r, 30000));
    if (!running || !agentId) break;
    try {
      const res = await post('/agents/heartbeat', { agentId, secret });
      if (res.cancelJobIds && res.cancelJobIds.length > 0) {
        for (const id of res.cancelJobIds) {
          const c = activeJobs.get(id);
          if (c) { c.abort(); activeJobs.delete(id); console.log('[agent] Aborted timed-out job:', id); }
        }
      }
      if (res.queues) {
        console.log('[agent] Queue update from platform:', res.queues.map(q => q.replace('workflow_step_', '')).join(', '));
      }
      if (res.status === 'draining') { console.log('[agent] Drain requested'); running = false; }
    } catch (err) {
      // Re-register if backend restarted
      if (err.message && (err.message.includes('Unknown agent') || err.message.includes('Invalid agent'))) {
        console.log('[agent] Heartbeat lost registration — re-registering...');
        try { await register(); console.log('[agent] Re-registered via heartbeat.'); } catch {}
      }
      // Silently retry on network errors
    }
  }
}

async function shutdown() {
  if (!running) return;
  running = false;
  // Abort the long-poll immediately (stop accepting new work)
  if (pollAbort) { pollAbort.abort(); pollAbort = null; }

  if (activeJobs.size > 0) {
    console.log('[agent] Draining', activeJobs.size, 'active job(s)... (Ctrl+C again to force quit)');
    // Second Ctrl+C = force quit
    const forceQuit = () => { console.log('[agent] Force quit'); process.exit(1); };
    process.on('SIGINT', forceQuit);
    process.on('SIGTERM', forceQuit);
    // Wait indefinitely for active jobs to finish — user can force quit anytime
    while (activeJobs.size > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('[agent] All jobs completed');
  }

  // Deregister
  if (agentId) {
    try { await post('/agents/deregister', { agentId, secret }); } catch {}
  }
  console.log('Bye!');
  process.exit(0);
}

let caps;

async function register() {
  caps = caps || detectCapabilities();
  const res = await post('/agents/register', {
    tenantId: TENANT, name: os.hostname(), hostname: os.hostname(),
    capabilities: caps, registrationToken: TOKEN, secret, maxConcurrent: 5,
  });
  agentId = res.agentId;
  console.log('[agent] Registered as', agentId);
}

async function main() {
  caps = detectCapabilities();
  console.log('');
  console.log('  Goat Agent — Remote Worker');
  console.log('  Platform:', BROKER);
  console.log('  Host:    ', os.hostname());
  console.log('  CPU:     ', caps.cpuCount, 'cores');
  console.log('  Memory:  ', Math.round(caps.memoryMB / 1024 * 10) / 10, 'GB');
  console.log('  Docker:  ', caps.dockerAvailable ? 'yes' : 'no');
  console.log('  Queues:  ', caps.queues.join(', '));
  console.log('');

  // Connect with retry — handles backend being down at startup
  let backoff = 1000;
  while (running) {
    try {
      await register();
      break;
    } catch (err) {
      console.error('[agent] Registration failed:', err.message, '- retrying in', backoff + 'ms');
      await new Promise(r => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30000);
    }
  }
  if (!running) return;

  console.log('  Waiting for jobs... (Ctrl+C to stop)\\n');
  heartbeatLoop();
  await pollLoop();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
`.trim()
}
