---
name: roundtable
description: |
  Run a structured multi-agent roundtable to solve a challenge.
  Orchestrates ChatGPT, Gemini, and Claude subagents with distinct roles.
  Maximizes creative divergence first, then converges without collapsing novelty.
  Use when facing complex decisions, architecture choices, or strategic problems.
  Requires: mcp__chrome-devtools__* or mcp__playwright__* tools, Task tool.
---

# Multi-Agent Roundtable

You are the **MEDIATOR** in a structured roundtable discussion between multiple AI agents.
Your job is to orchestrate, synthesize, and drive toward actionable outcomes.

## Arguments Provided

$ARGUMENTS

## How to Handle Arguments

**If arguments provided above:**
- Use the argument text as the **Challenge**
- Infer **Constraints** from conversation context and codebase knowledge
- Infer **Context** from the current repo/project (read CLAUDE.md, AGENT_HANDOVER.md if needed)
- Default **Output mode** to `portfolio` unless specified in arguments

**If no arguments (empty or blank):**
- Ask the user for Challenge, Constraints, Context, and Output mode

**Parsing hints:**
- `/do-roundtable How should we architect checkout?` → Challenge = "How should we architect checkout?"
- `/do-roundtable checkout architecture --mode=decision` → Challenge = "checkout architecture", Mode = decision
- `/do-roundtable` → Interactive mode, ask for inputs

## Intent

Solve complex challenges by leveraging diverse AI perspectives:
- **Maximize creative divergence** in early phases
- **Converge to decisions** without collapsing novelty
- **Preserve outliers** that are justified
- **Produce actionable output**

## Inputs Required

If not provided via arguments, gather from the user:

```
Challenge: [Problem to solve - be specific]
Constraints: [Hard constraints, budget, timeline, tech stack]
Context: [Repo/product/org context - what matters here]
Output mode: [decision | portfolio | exploration] (default: portfolio)
```

**Output modes:**
- `decision` - Single recommended path with fallback
- `portfolio` - 2-3 options to pursue in parallel
- `exploration` - Map the solution space, no commitment

## Agents Available

| Agent | Tool | Best For |
|-------|------|----------|
| Claude | Task (subagent) | Technical depth, codebase-aware |
| ChatGPT | Browser automation | Broad knowledge, creative |
| Gemini | Browser automation | Research, Google ecosystem |

## Orchestration Rules

1. **Agents must not see each other's responses until debate phase**
2. **Each agent gets ONE distinct role** (no overlap)
3. **No majority voting** - quality over consensus
4. **Outliers preserved** if justified with evidence
5. **Max 3 rounds** - terminate on convergence or timeout
6. **CRITICAL: Start fresh conversations** - Always begin with clean chat sessions

---

## Browser Setup (IMPORTANT)

**Before sending any prompts to ChatGPT or Gemini, you MUST start a new conversation.**

This ensures:
- No context contamination from previous chats
- Each agent responds only to the roundtable prompt
- Reproducible, isolated responses

### Starting a New ChatGPT Conversation

```yaml
# Option 1: Navigate directly to new chat
Tool: mcp__playwright__browser_navigate
Parameters:
  url: "https://chatgpt.com/"

# Option 2: Click "New chat" if already on ChatGPT
Tool: mcp__playwright__browser_evaluate
Parameters:
  function: |
    () => {
      // Click "New chat" link or use keyboard shortcut
      const newChatLink = document.querySelector('a[href="/"]');
      if (newChatLink) {
        newChatLink.click();
        return 'new chat started';
      }
      // Fallback: navigate directly
      window.location.href = '/';
      return 'navigated to home';
    }
```

### Starting a New Gemini Conversation

```yaml
# Option 1: Navigate directly to new chat
Tool: mcp__playwright__browser_navigate
Parameters:
  url: "https://gemini.google.com/app"

# Option 2: Click "New chat" if already on Gemini
Tool: mcp__playwright__browser_evaluate
Parameters:
  function: |
    () => {
      // Click "New chat" button
      const newChatBtn = document.querySelector('a[href="/app"]');
      if (newChatBtn) {
        newChatBtn.click();
        return 'new chat started';
      }
      // Fallback: navigate directly
      window.location.href = '/app';
      return 'navigated to home';
    }
```

### Verification

After starting a new conversation, **take a snapshot** to verify:
- The chat area is empty (no previous messages)
- The input field is ready for a new prompt

---

## Execution Plan

### Phase 1 — Role Assignment

Assign each agent ONE role based on the challenge:

| Role | Focus | Typical Assignment |
|------|-------|-------------------|
| **Explorer** | Novel ideas, non-obvious angles, "what if" | Gemini (broad search) |
| **Realist** | Constraints, feasibility, risks, blockers | Claude (codebase-aware) |
| **Optimizer** | Performance, cost, scalability, efficiency | ChatGPT (practical) |
| **Challenger** | Attack assumptions, edge cases, failure modes | Claude or rotate |

**Role assignment prompt template:**
```
You are the [ROLE] in a roundtable discussion.

Your focus: [ROLE DESCRIPTION]

Challenge: [CHALLENGE]
Constraints: [CONSTRAINTS]
Context: [CONTEXT]

Provide your analysis with this structure:
1. THESIS (1 sentence - your core position)
2. CORE IDEA (2-3 paragraphs - your proposed approach)
3. ASSUMPTIONS (bullet list - what must be true)
4. RISKS (bullet list - what could go wrong)
5. BLIND SPOTS (what others might miss that you see)

Be opinionated. Take a clear stance. Do not hedge.
```

### Phase 2 — Independent Generation (PARALLEL)

**CRITICAL: Start fresh conversations before sending prompts.**

Execute all three agents simultaneously:

```yaml
# Step 1: Start NEW conversations (do this first!)

# ChatGPT - Navigate to fresh chat
Tool: mcp__playwright__browser_navigate
Parameters:
  url: "https://chatgpt.com/"

# Gemini - Navigate to fresh chat
Tool: mcp__playwright__browser_navigate
Parameters:
  url: "https://gemini.google.com/app"

# Step 2: Verify clean state (take snapshots to confirm empty chats)

# Step 3: Launch prompts in parallel

# Agent 1: Claude (Realist)
Tool: Task
Parameters:
  subagent_type: "general-purpose"
  prompt: |
    You are the REALIST in a roundtable discussion.
    [Full prompt with challenge, constraints, context]

# Agent 2: ChatGPT (Optimizer)
# Use innerHTML with <p> tags for ProseMirror editor
Tool: mcp__playwright__browser_evaluate
Parameters:
  function: |
    () => {
      const input = document.querySelector('#prompt-textarea');
      if (!input) return 'input not found';
      input.focus();
      input.innerHTML = '<p>[YOUR PROMPT HERE]</p>';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'success';
    }

# Then click send button
Tool: mcp__playwright__browser_click
Parameters:
  element: "Send prompt button"
  ref: [ref from snapshot]

# Agent 3: Gemini (Explorer)
Tool: mcp__playwright__browser_evaluate
Parameters:
  function: |
    () => {
      const input = document.querySelector('div[contenteditable="true"]');
      if (!input) return 'input not found';
      input.focus();
      input.innerText = '[YOUR PROMPT HERE]';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'success';
    }

# Then click send button
Tool: mcp__playwright__browser_click
Parameters:
  element: "Send message button"
  ref: [ref from snapshot]
```

**Collect responses** - wait for all three to complete before proceeding.

### Phase 3 — Signal Weighting

Score each proposal independently (DO NOT MERGE YET):

| Criteria | Weight | 1-5 Scale |
|----------|--------|-----------|
| **Novelty** | 20% | How original? Avoids obvious solutions? |
| **Feasibility** | 30% | Can we actually build this? Resources? |
| **Impact** | 30% | If it works, how much value? |
| **Risk** | 20% | What's the downside? Reversible? |

**Scoring template:**
```
## Agent: [NAME] - Role: [ROLE]

### Thesis
[Their 1-sentence thesis]

### Scores
- Novelty: X/5 - [reason]
- Feasibility: X/5 - [reason]
- Impact: X/5 - [reason]
- Risk: X/5 - [reason]
- **Weighted: X.X/5**

### Key insight
[What's unique about this perspective]

### Concern
[Main weakness or gap]
```

### Phase 4 — Cross-Examination (Bounded)

Each agent critiques ONE other proposal (rotate assignment):
- Claude critiques → ChatGPT's proposal
- ChatGPT critiques → Gemini's proposal
- Gemini critiques → Claude's proposal

**Cross-examination prompt:**
```
Another agent proposed the following approach:

THESIS: [Their thesis]
APPROACH: [Their core idea]
ASSUMPTIONS: [Their assumptions]

Your task:
1. Identify the STRONGEST aspect of this proposal
2. Identify the WEAKEST aspect (be specific)
3. Propose ONE constructive improvement or hybrid idea
4. State what you would STEAL from this for your own approach

Do not repeat criticisms. Be constructive.
```

**Rules:**
- No repetition of critiques
- Must propose constructive alternative
- Must acknowledge something valuable

### Phase 5 — Synthesis (Mediator Logic)

As the mediator, you now synthesize:

**Step 1: Cluster by approach**
```
Cluster A: [Description]
- Agent X's proposal
- Similar aspects from Agent Y

Cluster B: [Description]
- Agent Z's proposal
- Unique angle

Outlier: [Description]
- High-novelty idea that doesn't fit clusters
- Justification for preserving
```

**Step 2: Generate options**
```
Option 1: [Name]
- Based on: [Which agent(s)]
- Core approach: [Description]
- Pros: [List]
- Cons: [List]
- Best if: [Condition]

Option 2: [Name]
- ...

Hybrid Option: [Name]
- Combines: [Elements from multiple]
- Core approach: [Description]
- Pros: [List]
- Cons: [List]
```

**Step 3: Evaluate against constraints**
- Does it fit the hard constraints?
- Does it address the core challenge?
- Is it actionable?

### Phase 6 — Resolution

Produce final output based on **Output mode**:

---

#### Mode: `decision`

```markdown
## Roundtable Decision

### Challenge
[Original challenge]

### Recommended Approach
**[Option name]**

[2-3 sentence description]

### Why This Option
- [Reason 1]
- [Reason 2]
- [Reason 3]

### Key Risk
[Single biggest risk and mitigation]

### Fallback
If [condition], pivot to [alternative approach]

### Dissenting View
[Preserved outlier perspective, if valuable]

### Next Actions
1. [Immediate step]
2. [Validation step]
3. [First milestone]
```

---

#### Mode: `portfolio`

```markdown
## Roundtable Portfolio

### Challenge
[Original challenge]

### Options to Pursue

#### Option 1: [Name] ⭐ Primary
[Description]
- **Effort:** [Low/Medium/High]
- **Risk:** [Low/Medium/High]
- **Upside:** [Description]
- **Start with:** [First action]

#### Option 2: [Name]
[Description]
- **Effort:** [Low/Medium/High]
- **Risk:** [Low/Medium/High]
- **Upside:** [Description]
- **Start with:** [First action]

#### Option 3: [Name] (Experimental)
[Description]
- **Effort:** [Low/Medium/High]
- **Risk:** [Low/Medium/High]
- **Upside:** [Description]
- **Start with:** [First action]

### Hybrid Potential
[How options could combine]

### Decision Criteria
When to pick each:
- Option 1 if: [condition]
- Option 2 if: [condition]
- Option 3 if: [condition]

### Next Actions
1. [Parallel track 1]
2. [Parallel track 2]
3. [Decision point milestone]
```

---

#### Mode: `exploration`

```markdown
## Roundtable Exploration

### Challenge
[Original challenge]

### Solution Space Map

#### Approach Category A: [Name]
[Description of this family of solutions]
- Variant 1: [Description]
- Variant 2: [Description]
- Key tradeoff: [What you give up]

#### Approach Category B: [Name]
[Description]
- Variant 1: [Description]
- Variant 2: [Description]
- Key tradeoff: [What you give up]

#### Approach Category C: [Name]
[Description]
- Variant 1: [Description]
- Variant 2: [Description]
- Key tradeoff: [What you give up]

### Frontier Ideas (High Novelty)
- [Idea 1]: [Why interesting, why risky]
- [Idea 2]: [Why interesting, why risky]

### Key Uncertainties
- [Uncertainty 1]: Resolves toward [A or B]
- [Uncertainty 2]: Resolves toward [C or D]

### Recommended Exploration Path
1. [What to validate first]
2. [What to prototype]
3. [Decision point]

### What We Learned
[Synthesis of key insights from the roundtable]
```

---

## Implementation Checklist

```
[ ] Gather inputs (challenge, constraints, context, output mode)
[ ] Assign roles to agents
[ ] Phase 2: Launch parallel generation
    [ ] **Start NEW ChatGPT conversation** (navigate to chatgpt.com/)
    [ ] **Start NEW Gemini conversation** (navigate to gemini.google.com/app)
    [ ] Verify clean chat state (take snapshots)
    [ ] Claude subagent sent
    [ ] ChatGPT prompt sent (browser)
    [ ] Gemini prompt sent (browser)
[ ] Collect all responses
[ ] Phase 3: Score each proposal
[ ] Phase 4: Cross-examination round
    [ ] Claude critiques ChatGPT
    [ ] ChatGPT critiques Gemini
    [ ] Gemini critiques Claude
[ ] Collect critique responses
[ ] Phase 5: Synthesize clusters and options
[ ] Phase 6: Generate output per mode
[ ] Present to user
```

## Tips for the Mediator

1. **Don't bias toward consensus** - Disagreement is signal
2. **Preserve novelty** - Don't sand down interesting edges
3. **Be explicit about tradeoffs** - No free lunches
4. **Time-box each phase** - Don't let agents ramble
5. **Trust the structure** - The phases exist for a reason
6. **Always start fresh** - Previous conversation context will contaminate responses; navigate to clean chat URLs before each roundtable

## Example Invocations

### With Arguments (Recommended)

```
/do-roundtable How should we architect the multi-tenant checkout flow?
```
→ Uses argument as challenge, infers context from codebase, defaults to `portfolio` mode.

```
/do-roundtable Should we use Redis or Postgres for session storage? --mode=decision
```
→ Uses argument as challenge, outputs a single decision with fallback.

```
/do-roundtable What are our options for real-time notifications? --mode=exploration
```
→ Maps the solution space without committing to a decision.

### Without Arguments (Interactive)

```
/do-roundtable
```

Mediator: "I'll run a multi-agent roundtable. Please provide:
- **Challenge**: What problem are we solving?
- **Constraints**: Hard limits (budget, timeline, tech)?
- **Context**: What should agents know about the situation?
- **Output mode**: `decision`, `portfolio`, or `exploration`?"

User provides inputs → Mediator executes phases → Final output delivered.

### With Conversation Context

If you've been discussing a topic, just reference it:
```
/do-roundtable the caching strategy we discussed above
```
→ Mediator uses conversation context + argument to understand the challenge.
