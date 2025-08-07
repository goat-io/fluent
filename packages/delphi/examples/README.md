# Delphi Examples

Example scripts demonstrating Delphi's multi-agent consensus system.

## Core Examples

### Agreement Pipeline (`agreement-pipeline.ts`)
Production-ready multi-agent consensus for code reviews and architectural decisions.

```bash
# Code review
npx tsx examples/agreement-pipeline.ts review --goal "Review PR for security"

# Architecture decision
npx tsx examples/agreement-pipeline.ts architecture --goal "Choose database"

# Refactoring discussion
npx tsx examples/agreement-pipeline.ts refactor --goal "Improve performance"
```

### Model Configuration (`model-configuration.ts`)
Different ways to configure AI models for agents.

```bash
npx tsx examples/model-configuration.ts simple    # Basic string config
npx tsx examples/model-configuration.ts custom    # Custom parameters
npx tsx examples/model-configuration.ts cost      # Cost-optimized
npx tsx examples/model-configuration.ts highstakes # Premium models
```

### Session Cleanup (`agreement-with-cleanup.ts`)
Memory management for long-running processes.

```bash
npx tsx examples/agreement-with-cleanup.ts
```

### Claude Integration (`claude-sonnet-trial.ts`)
Test Claude models and run security reviews.

```bash
# Test connection
npx tsx examples/claude-sonnet-trial.ts test-connection

# Security review
npx tsx examples/claude-sonnet-trial.ts review

# With specific model
npx tsx examples/claude-sonnet-trial.ts review --model claude-3-5-sonnet
```

## Setup

### With API Keys
```bash
export ANTHROPIC_API_KEY=sk-ant-api11-...
export OPENAI_API_KEY=sk-...
```

### With OpenCode (Claude Subscription)
```bash
# Uses your Claude Pro/Max subscription
opencode run "npx tsx examples/agreement-pipeline.ts review"
```

## Requirements

- Node.js 18+
- TypeScript (`npm install -g tsx`)
- LLM API access (API keys or OpenCode subscription)