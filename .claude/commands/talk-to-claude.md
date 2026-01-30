---
name: claude-subagent
description: |
  Get a second opinion or parallel analysis from another Claude instance. Use this skill when:
  - User asks to "talk to Claude", "ask another Claude", or "get a second opinion"
  - User wants collaborative analysis or brainstorming
  - User wants to compare different approaches to a problem
  Requires: Task tool with general-purpose subagent.
---

# Claude Subagent Interaction

Spawn a separate Claude instance for parallel analysis or second opinions.

## Why Use This?

Unlike Gemini or ChatGPT (which require browser automation), Claude can spawn subagents directly using the Task tool. This is:
- **Faster** - No browser overhead
- **More reliable** - No DOM selectors to break
- **Context-aware** - Subagent can access the codebase

## How to Use

### Simple Second Opinion

```yaml
Tool: Task
Parameters:
  subagent_type: "general-purpose"
  prompt: |
    I need a second opinion on the following:

    [TOPIC OR QUESTION HERE]

    Please provide your independent analysis without being influenced by any prior context.
```

### Code Review

```yaml
Tool: Task
Parameters:
  subagent_type: "general-purpose"
  prompt: |
    Please review the following code and provide feedback on:
    - Potential bugs or issues
    - Performance considerations
    - Code style and readability
    - Alternative approaches

    [CODE OR FILE PATH HERE]
```

### Architecture Discussion

```yaml
Tool: Task
Parameters:
  subagent_type: "general-purpose"
  prompt: |
    I'm considering the following architectural approach:

    [DESCRIBE APPROACH]

    Please analyze this approach and:
    1. List pros and cons
    2. Identify potential issues
    3. Suggest alternatives if applicable
```

### Brainstorming

```yaml
Tool: Task
Parameters:
  subagent_type: "general-purpose"
  prompt: |
    Help me brainstorm solutions for:

    [PROBLEM DESCRIPTION]

    Generate 3-5 different approaches, each with a brief explanation of trade-offs.
```

## Specialized Subagents

For domain-specific questions, use specialized agents:

| Domain | subagent_type | Use For |
|--------|---------------|---------|
| Backend API | `sodium-backend` | tRPC, Prisma, Firebase questions |
| Commerce | `sodium-commerce` | Cart, checkout, WooCommerce |
| Mobile | `sodium-expo` | Expo, React Native |
| Frontend | `sodium-frontend` | Next.js, web UI |
| WordPress | `sodium-wordpress` | PHP, WooCommerce |
| Infrastructure | `sodium-infra` | Pulumi, Docker, GCP |
| Database | `sodium-sql` | Prisma, MySQL |
| Codebase exploration | `Explore` | Finding files, understanding code |
| Implementation planning | `Plan` | Designing solutions |

### Example: Backend Second Opinion

```yaml
Tool: Task
Parameters:
  subagent_type: "sodium-backend"
  prompt: |
    Review the tRPC endpoint at apps/backend/src/api/posts.router.ts

    Is there a better way to handle pagination? What about caching?
```

## Key Differences from Browser-Based Skills

| Aspect | Gemini/ChatGPT | Claude Subagent |
|--------|----------------|-----------------|
| Method | Browser automation | Task tool |
| Speed | Slow (page loads) | Fast (direct) |
| Reliability | DOM-dependent | Stable API |
| Codebase access | None | Full access |
| Context | Isolated | Can read files |

## When to Use Each

- **Claude Subagent**: Technical analysis, code review, codebase questions
- **ChatGPT**: When you specifically want GPT's perspective or capabilities
- **Gemini**: When you specifically want Gemini's perspective or Google integration

## Notes

- Subagents run independently and return results when complete
- Use `run_in_background: true` for long-running analyses
- Subagents have full access to codebase tools (Read, Grep, Glob, etc.)
- Results are synthesized by the coordinator (main Claude instance)
