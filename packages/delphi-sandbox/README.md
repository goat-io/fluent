# @goatlab/delphi-sandbox

Docker-sandboxed step execution for `@goatlab/delphi-core`. Run untrusted code (LLM-generated scripts, Claude Code tasks, third-party integrations) inside isolated containers with network egress locked down by default.

## What it is

A `StepExecutor` that launches a Docker container per step, pipes input/output through the container, and tears it down on completion. Enforces:

- **Network**: `NetworkMode: none` by default; optional `allowedDomains` list materialized as `iptables` rules inside the container
- **Filesystem**: ephemeral overlay; no host mounts unless explicitly opted in
- **Resources**: per-step CPU and memory limits
- **Lifecycle**: respects the engine's step timeout; SIGKILL + cleanup on deadline

Supports Docker-in-Docker (DinD) for workloads that need to build or run their own containers.

## Install

```bash
pnpm add @goatlab/delphi-sandbox @goatlab/delphi-core dockerode
```

Requires a reachable Docker daemon (local socket or `DOCKER_HOST`).

## Quick start

```ts
import { SandboxStepExecutor } from '@goatlab/delphi-sandbox'

engine.registerExecutor('sandbox', new SandboxStepExecutor({
  defaultImage: 'python:3.12-slim',
  defaultNetwork: 'none',
}))

WorkflowBuilder.create('run_user_script')
  .step('exec', {
    executorType: 'sandbox',
    stepWeight: 'sandbox',   // routes to workflow_step_sandbox queue
    executorConfig: {
      image: 'python:3.12-slim',
      cmd: ['python', '-c', 'print({{ input.code | tojson }})'],
      timeoutMs: 30_000,
      memoryMb: 512,
      cpus: 0.5,
      allowedDomains: ['api.openai.com'],   // only these domains reachable
    },
  })
  .build()
```

Step output (`stdout`, `stderr`, exit code, optional JSON parsed from the last stdout line) is returned as a normal `StepResult`.

## Security model

| Control | Default |
|---|---|
| Network | `none` — no egress at all |
| Allowed domains | empty (opt-in via `allowedDomains`, enforced with `iptables -A OUTPUT` inside a sidecar init) |
| Filesystem | no bind mounts; overlay scratch only |
| User | non-root inside the container |
| Capabilities | dropped to minimal set |
| PID/IPC | container's own namespace |
| DinD | off; enable per-step via `enableDockerInDocker: true` |

The `allowedDomains` list is enforced at step-start time by resolving each domain once and installing `iptables` ACCEPT rules. DNS inside the container is pinned to avoid revalidation bypasses.

## Use cases

- **LLM-generated code execution**: safe by default, no risk of exfiltration to unexpected endpoints
- **Claude Code / agent actions**: container is torn down after each step, no state leakage across runs
- **Third-party integrations**: isolate SDKs that bring surprising dependencies
- **Compile/build tasks**: use DinD mode

## Testing

```bash
pnpm test:unit          # pure unit tests, no Docker needed
pnpm test:integration   # starts a real Docker daemon and spins containers
pnpm test:e2e           # end-to-end against a full engine + sandbox
```

## Key exports

| Export | Purpose |
|---|---|
| `SandboxStepExecutor` | Register on the engine as `executorType: 'sandbox'` |
| `SandboxStepConfig` | Executor config shape |
| `enforceAllowedDomains(container, domains)` | Helper to install `iptables` ACCEPT rules |

## License

MIT
