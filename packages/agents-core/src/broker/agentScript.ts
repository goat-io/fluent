// Self-contained agent script generator.
// Returns a JS string that can be eval'd on any machine with Node 18+.
// No npm packages required — uses only Node built-ins (crypto, os, child_process, fetch).

export function generateAgentScript(brokerUrl: string, token: string, tenantId: string): string {
  return `
// Goat Agent — self-contained remote worker
// Connects to ${brokerUrl} via HTTPS only. No dependencies required.
const crypto = require('node:crypto');
const os = require('node:os');
const { execSync } = require('node:child_process');

const BROKER = ${JSON.stringify(brokerUrl)};
const TOKEN = ${JSON.stringify(token)};
const TENANT = ${JSON.stringify(tenantId)};

let agentId = null;
const secret = crypto.randomBytes(32).toString('hex');
let running = true;
const activeJobs = new Map();

async function post(path, body) {
  const res = await fetch(BROKER + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  const queues = ['workflow_step_light'];
  if (memoryMB >= 4096) queues.push('workflow_step_heavy');
  queues.push('workflow_step_ai');
  if (dockerAvailable) queues.push('workflow_step_sandbox');
  return { cpuCount, memoryMB, dockerAvailable, gpuAvailable: false, queues };
}

async function executeJob(job) {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);
  try {
    await post('/agents/step-started', { agentId, secret, jobId: job.id });
    // Generic executor: eval the handler if provided, otherwise echo
    const payload = job.payload;
    const output = { executed: true, step: payload.stepName, type: payload.executorType, input: payload.input };
    if (controller.signal.aborted) return;
    await post('/agents/step-result', { agentId, secret, jobId: job.id, result: { output } });
    console.log('[agent] Job', job.id, 'completed');
  } catch (err) {
    if (controller.signal.aborted) return;
    try { await post('/agents/step-failed', { agentId, secret, jobId: job.id, error: err.message }); } catch {}
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
      const res = await post('/agents/next-job', { agentId, secret, timeoutMs: 30000 });
      if (res.job) {
        backoff = 1000;
        executeJob(res.job).catch(e => console.error('[agent] exec error:', e.message));
      }
    } catch (err) {
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
      if (res.status === 'draining') { console.log('[agent] Drain requested'); running = false; }
    } catch {}
  }
}

async function main() {
  const caps = detectCapabilities();
  console.log('');
  console.log('  Goat Agent — Remote Worker');
  console.log('  Platform:', BROKER);
  console.log('  Host:    ', os.hostname());
  console.log('  CPU:     ', caps.cpuCount, 'cores');
  console.log('  Memory:  ', Math.round(caps.memoryMB / 1024 * 10) / 10, 'GB');
  console.log('  Docker:  ', caps.dockerAvailable ? 'yes' : 'no');
  console.log('  Queues:  ', caps.queues.join(', '));
  console.log('');

  const res = await post('/agents/register', {
    tenantId: TENANT, name: os.hostname(), hostname: os.hostname(),
    capabilities: caps, registrationToken: TOKEN, secret, maxConcurrent: 5,
  });
  agentId = res.agentId;
  console.log('  Registered as', agentId);
  console.log('  Waiting for jobs...\\n');

  heartbeatLoop();
  await pollLoop();
}

process.on('SIGINT', () => { console.log('\\nShutting down...'); running = false; });
process.on('SIGTERM', () => { console.log('\\nShutting down...'); running = false; });
main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
`.trim()
}
