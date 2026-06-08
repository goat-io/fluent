---
name: Brain Skills
description: Generic Claude Code skills usable by any company adopting Brain. Reachable at .claude/skills/<name> via symlinks.
last-updated: 2026-05-12
owner: engineering
status: active
---

# Skills

Generic Claude Code skills that ship with Brain. Each is reachable at `.claude/skills/<name>/SKILL.md` (symlink into here) so Claude Code's runtime discovers them.

| Skill | Purpose |
|-------|---------|
| `analyze-repo` | Methodology for analysing a single source-code repo and producing a `kind: repo` catalog entry |
| `catchup` | Onboarding skill — reads files in dependency order until the agent has enough context |
| `document-learning` | End-of-session knowledge capture into the Brain's markdown files |
| `diagram-solution` | How to build diagrams that don't lie |

## Adding a new generic skill

1. Drop `brain/skills/<name>/SKILL.md` (with the standard skill frontmatter)
2. `ln -s ../../brain/skills/<name> .claude/skills/<name>` so Claude Code finds it
3. Update this README

## Company-specific skills

Skills that depend on a company's specific tooling (e.g. `checkaws` reaching into the company's AWS accounts) stay in `.claude/skills/<name>/` directly — they are not part of Brain.
