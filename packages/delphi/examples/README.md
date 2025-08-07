# Delphi Agreement System Examples

This directory contains examples demonstrating various features of the Delphi agreement system.

## Examples

### 1. `agreement-pipeline.ts`
Production-ready pipeline integrating the agreement system with LangGraph. Shows how to use multi-agent consensus for:
- Code review workflows
- Architecture decisions
- Refactoring discussions

**Usage:**
```bash
npx tsx agreement-pipeline.ts review --goal "Review authentication module"
npx tsx agreement-pipeline.ts architecture --goal "Design microservices"
npx tsx agreement-pipeline.ts refactor --goal "Refactor payment system"
```

### 2. `model-configuration.ts`
Demonstrates different ways to configure AI models for agents:
- Simple string-based model selection
- Custom model configurations with parameters
- Mixed strategy and override approach
- Cost-optimized configurations
- High-stakes configurations with best models

**Usage:**
```bash
npx tsx model-configuration.ts simple     # Basic model selection
npx tsx model-configuration.ts custom     # Custom parameters
npx tsx model-configuration.ts mixed      # Strategy + overrides
npx tsx model-configuration.ts cost       # Budget-friendly
npx tsx model-configuration.ts highstakes # Maximum quality
```

### 3. `agreement-with-cleanup.ts`
Shows how to configure session cleanup to prevent memory leaks in long-running processes:
- Configurable retention periods
- Automatic cleanup intervals
- Manual cleanup triggers
- Session monitoring

**Usage:**
```bash
npx tsx agreement-with-cleanup.ts
```

## Key Features Demonstrated

### Model Configuration
- **Integrated**: Model selection directly in agent definitions
- **Flexible**: Use presets, custom configs, or strategies
- **Diverse**: Mix different AI models for different roles
- **Optimized**: Choose models based on task requirements

### Session Management
- **Cleanup**: Automatic removal of old sessions
- **Retention**: Configurable data retention policies
- **Monitoring**: Track active sessions and resource usage
- **Safety**: Prevent memory leaks in production

### Production Patterns
- **Error handling**: Proper timeout and error management
- **Resource cleanup**: Always close orchestrators
- **Type safety**: Full TypeScript support
- **Logging**: Structured logging with Pino

## Quick Start

1. Install dependencies:
```bash
pnpm install
```

2. Set up your environment variables (if needed):
```bash
export OPENAI_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key
```

3. Run an example:
```bash
npx tsx model-configuration.ts simple
```

## Model Presets

The system includes presets for popular models:
- **OpenAI**: gpt-4o, gpt-3.5-turbo, o3
- **Anthropic**: claude-opus-4.1, claude-3-sonnet, claude-3-haiku
- **Google**: gemini-pro, gemini-ultra, gemini-flash
- **Others**: mistral-large, mixtral, command-r-plus

## Best Practices

1. **Model Selection**: Choose models based on task complexity and budget
2. **Cleanup**: Always configure session cleanup for production
3. **Strategies**: Use predefined strategies for common scenarios
4. **Monitoring**: Enable logging and metrics for production debugging
5. **Testing**: Use mock agents for unit tests