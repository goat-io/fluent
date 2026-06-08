---
name: handover
description: "End-of-session handover — pause all work, capture lessons learned, then rewrite the root AGENT_HANDOVER.md so the next agent starts cold with zero context."
when_to_use: "handover", "write a handover", "wrap up the session", "end of session", "i'm stopping for the day", "next agent will continue", "/handover"
allowed-tools: Read Write Edit Bash Glob Grep
---

# Handover Skill

Pause all work. Create a complete handover in two steps.

## Scope: local sessions only

`AGENT_HANDOVER.md` is a **local-session snapshot** and is **gitignored**
(`/AGENT_HANDOVER.md`). It is a scratchpad for the next agent on *this machine*,
not a shared artifact. Do not commit it, do not push it, do not rely on it
surviving outside the local working tree.

Durable knowledge is NOT the job of this file. Anything another agent or a
teammate would need on a fresh clone goes to:
- **`narratives/handovers/YYYY-MM-DD-<topic>.md`** — the dated, committed
  audit trail (Step 1 / `/document-learning`).
- **The Brain** (`narratives/…`, `catalog/…`) — corrections, architecture,
  decisions, confirmed facts.

So: if there is no local working tree to hand off (e.g. a remote/CI run, or a
session whose output is purely documentation), **skip `AGENT_HANDOVER.md`
entirely** and put everything in lessons-learned / the dated narrative handover.
The root file exists only to bridge consecutive local sessions.

## Step 1: Capture Lessons Learned

Before writing the handover, reflect on this session. Run `/document-learning` to capture
any hard-won knowledge into the lessons-learned files. If that skill is not
available in this repo, skip this step but mention it in the handover.

## Step 2: Write the Handover

Update the single `AGENT_HANDOVER.md` in the **root** of the project with the
exact structure below. Replace the previous session's content entirely — this
is not an append log.

```markdown
# Agent Handover - Delphi Brain

**Last Updated:** <today's date> (Session N)

## Current State

What was the goal? What got done? What's still in progress?
Use a table:

| Component | Status | Details |
|---|---|---|
| ... | ✓ green / ⚠ amber / ✗ red | one-line |

## Blockers / Open Issues

For each blocker, do a 5-why root cause analysis so the next agent can pick
up immediately:

### <Blocker title>
1. **Why is X failing?** … because Y.
2. **Why Y?** … because Z.
3. **Why Z?** … because …
4. **Why …?** …
5. **Why …?** **Root cause:** …

**Next action:** one concrete sentence the next agent can act on.

## Key Decisions

Important architectural or design decisions made this session that affect
future work. One bullet per decision, with the reasoning.

## Key Files Changed

Group by app / package. Only list files that matter for context — not every
single edit.

### <app or area>
- `path/to/file.ext` — one-line why it changed

## Tips for Next Agent

Actionable tips that will save the next agent time. Include:

- Running processes or tunnels that may still be open (port-forwards, sims,
  background jobs).
- Gotchas specific to the current state.
- What to do first vs. what can wait.

## Production State

Current versions, tenant status, health. One short line per env.
```

## Rules

- **Only update the ROOT `AGENT_HANDOVER.md`** — do NOT update or create
  per-app handover files.
- **Replace** the previous session's content entirely. The file is a
  snapshot, not an append log.
- **Be specific and actionable.** The next agent starts cold with zero
  context. "Fix the auth bug" is useless; "auth.py:62 requires sub but
  KC 25 lightweight tokens omit it — fall back to preferred_username" is
  useful.
- **Quote file paths with line numbers** where the next agent will look
  (`path/to/file.py:42`).
- **5-why is mandatory for every blocker.** No "broken, look into it"
  placeholders.

## Discovery

Before writing, run a quick survey so the handover reflects the current
state, not your memory of it:

```bash
git status --short                 # what's uncommitted
git log --oneline -10              # what landed this session
ls narratives/handovers/ 2>/dev/null | sort -r | head -3   # prior context
```

If `narratives/handovers/` exists (the company convention), the historical
narrative handovers there are *separate* from the root `AGENT_HANDOVER.md`.
The root file is the **single live entry point**; the dated narratives are
the audit trail. Do not collapse them into one.

## Session Numbering

Bump `Session N` by 1 from the previous file. If you cannot tell what the
previous number was, scan the previous content for `Session \d+` and
increment.

## After Writing

End your reply with a one-line summary and the path: `Handover written to
AGENT_HANDOVER.md (Session N).` — nothing else. The user reads the file.
