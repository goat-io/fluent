# Delphi - Automated Self-Correcting Dev Pipeline

Delphi is an automated, self-correcting development pipeline that combines AutoGen agents for planning and discussion, Claude Code for repository editing, LangGraph for orchestration and control flow, and Redis for state persistence.

## Architecture Overview

### Core Layers

1. **Agent Layer (AutoGen)**
   - Planner: Drafts technical specifications
   - Refiners: Iterate and improve specifications
   - Reviewer: Judges the implementation diff
   - All agents are ConversableAgents with swappable models

2. **Orchestration Layer (LangGraph)**
   - GraphBuilder DAG encodes: plan → refine → code → review
   - Feedback edge loops back to refine on failure
   - Redis checkpoints enable crash-safe resume

3. **Execution Layer (Claude Code + MCP)**
   - Runs `claude -p "<spec>" --diff` in your repository
   - Pulls context from MCP servers (GitHub, Jira, etc.)
   - Outputs clean git patches

4. **Memory & State (Redis)**
   - langgraph-checkpoint-redis stores every state object
   - First-run `checkpointer.setup()` wires Redis keys
   - Enables multi-worker scaling and fault tolerance

## End-to-End Flow

1. User supplies a plain-text goal
2. Planner rewrites it into an actionable spec
3. Refiners chat until the spec is unambiguous
4. Claude Code edits the codebase and returns a diff
5. Reviewer LLM inspects tests + diff
6. If not approved, LangGraph loops back to step 3
7. If approved, the patch is ready to merge

## Installation

### Prerequisites

```bash
# Global tools
npm install -g @anthropic-ai/claude-code  # Claude Code CLI
npm install -g tsx                        # Run TypeScript directly

# Redis server
docker run -d -p 6379:6379 redis:latest

# Python environment for AutoGen
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
```

### Project Setup

```bash
# Install Node dependencies
cd apps/delphi
npm install

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### MCP Configuration

Add MCP credentials via Claude:
```bash
claude mcp add
```

## Usage

### Start Services

```bash
# Terminal 1: Start Redis (if not using Docker)
redis-server

# Terminal 2: Start AutoGen service
npm run autogen
# or
python autogen_service.py

# Terminal 3: Run the pipeline
npm start "Your task description here"
# or
npx tsx src/graph.ts "Add OpenTelemetry tracing to all Fastify routes"
```

### Examples

```bash
# Simple refactoring
npx tsx src/graph.ts "Migrate Express API to Fastify"

# Complex feature
npx tsx src/graph.ts "Add multi-tenant support with database isolation"

# From specification file
cat spec.md | npx tsx src/graph.ts
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: For AutoGen GPT agents
- `ANTHROPIC_API_KEY`: For Claude agents
- `REDIS_URL`: Redis connection (default: `redis://localhost:6379`)
- `AUTOGEN_SERVICE_URL`: AutoGen service endpoint
- `TEST_COMMAND`: Custom test command (default: `npm test`)
- `ENABLE_TESTS`: Enable/disable test execution
- `MAX_ITERATIONS`: Maximum refinement loops (default: 5)

### Graph Configuration

Edit `src/graph.ts` to customize:
- Node behaviors
- Edge conditions
- Timeout values
- MCP server connections

## Development

### Project Structure

```
apps/delphi/
├── src/                    # TypeScript source code
│   ├── graph.ts           # Main LangGraph orchestrator
│   ├── memory.ts          # Redis state persistence
│   ├── types.ts           # TypeScript definitions
│   └── __tests__/         # TypeScript tests
├── python/                 # Python AutoGen service
│   ├── autogen_service.py # FastAPI AutoGen wrapper
│   ├── test_autogen_service.py # Python tests
│   ├── requirements.txt   # Python dependencies
│   └── venv/             # Python virtual environment
├── package.json           # Node dependencies
├── tsconfig.json         # TypeScript config
├── start.sh              # One-command startup script
└── stop.sh               # Cleanup script
```

### Extending the Pipeline

1. **Add New Agents**: Modify `python/autogen_service.py`
2. **Add Graph Nodes**: Update `src/graph.ts`
3. **Custom Memory**: Extend `RedisMemorySaver` class
4. **New MCP Servers**: Configure in Claude Code

### Testing

```bash
# Run TypeScript tests
npm test

# Run Python tests
npm run test:python

# Type checking
npm run typecheck

# Linting
npm run lint

# Run all tests with coverage
npm run test:coverage
```

## Design Principles

- **Agent chat ≠ orchestration**: AutoGen handles reasoning; LangGraph guarantees deterministic control
- **Terminal-native edits**: Claude Code's diff mode avoids brittle copy-paste
- **Resumable & scalable**: Redis checkpoints enable multi-worker deployment
- **Type-safe**: Full TypeScript with Zod validation

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check `REDIS_URL` in `.env`

2. **AutoGen Service Error**
   - Verify API keys are set
   - Check service is running on port 8000

3. **Claude Code Not Found**
   - Install globally: `npm install -g @anthropic-ai/claude-code`
   - Or update `claudeCodePath` in config

4. **Type Errors**
   - Run `npm install` to ensure all dependencies
   - Check TypeScript version compatibility

## Performance Considerations

- AutoGen agents use `gpt-4o-mini` by default (fast + cheap)
- Redis checkpoints add ~50ms overhead per state transition
- Claude Code execution typically takes 30-120 seconds
- Max 5 refinement iterations prevents infinite loops

## Security

- Never commit `.env` files
- Use environment-specific Redis passwords
- Sandbox Claude Code execution for untrusted diffs
- Rotate API keys regularly

## License

Part of the Gealium/Sodium platform. See root LICENSE file.