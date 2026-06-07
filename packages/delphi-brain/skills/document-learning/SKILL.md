---
name: document-learning
description: "End-of-session knowledge capture. Updates the Brain's markdown files with everything learned, discovered, or corrected during the session."
argument-hint: "[area: architecture|catalog|roadmap|operations|business]"
allowed-tools: Read Write Edit Glob Grep Bash Agent
---

# Document Learning — End-of-Session Knowledge Capture

Run this at the end of a session to make sure everything you learned gets captured in the Brain so future agents don't repeat your work.

This is a two-phase process: first update the knowledge base, then verify quality.

---

## Phase 1: Update the Brain

Review what you discovered, built, debugged, or learned this session. Identify knowledge that belongs in the Brain's markdown files.

### What belongs in the Brain

- How a system actually works (confirmed through code, logs, or testing)
- Architectural patterns, data flows, integration points between services
- Corrections to things the docs currently get wrong
- Configuration or behavior not obvious from reading code alone
- New repos, services, or infrastructure not yet cataloged
- Changes to team ownership, system status, or maturity assessments
- Gotchas and non-obvious facts that affect multiple future tasks

### What does NOT belong

- Session-specific details (temporary state, debug logs, conversation context)
- Things obvious from reading the code directly
- Speculative plans or ideas not yet confirmed
- Duplicate information already well-covered in existing files
- Code — link to source repos, don't paste code here

### Where things go

Map your knowledge to the right location:

| What you learned | Where it goes |
|-----------------|---------------|
| How a specific repo works | `catalog/repos/<repo-name>/README.md` |
| How systems connect or communicate | `narratives/architecture/dependencies.md` or `communication-flows.md` |
| End-to-end flow (alarm, FOTA, etc.) | `narratives/architecture/business-flows.md` |
| Where data lives or moves | `narratives/architecture/data-flows.md` |
| Tech stack changes | `narratives/architecture/tech-landscape.md` |
| API discovery | `narratives/apis/overview.md` |
| Infrastructure/hosting changes | `narratives/infrastructure/overview.md` |
| Security findings | `narratives/security/overview.md` |
| New terminology | `narratives/company/glossary.md` |
| Org/team changes | `narratives/company/org-chart.md` |
| Roadmap decisions or proposals | `narratives/roadmap/` (new file or update existing) |
| Tool/SaaS changes | `narratives/operations/tools.md` |
| External integration discovery | `narratives/operations/integrations.md` |
| Operational procedure | `narratives/operations/runbooks/` (new file from template) |
| Incident documentation | `narratives/operations/incidents/` (new file from template) |

### Process

1. **Read before writing.** Before updating any file, read it first. You cannot improve docs you haven't read. Understand what's already there to avoid duplication.

2. **Verify before documenting.** Every claim must be something you confirmed this session — through source code, logs, testing, or direct observation. If unsure, grep the codebase or check the code. Mark unconfirmed things with `_TBD: confirm with [team]_`. Never document assumptions as facts.

3. **Fix what's wrong.** If existing docs contain incorrect information, outdated paths, wrong descriptions, or stale status — fix them. The Brain is not append-only. Remove or correct stale content. Update `last-updated` in frontmatter when you modify a file.

4. **Add what's missing.** If you discovered something not documented anywhere:
   - Update an existing file when the knowledge fits an existing topic
   - Create a new file only if no existing file covers this concept
   - New files **must** have YAML frontmatter (`name`, `description`, `last-updated`, `owner`, `status`)
   - Filenames: `kebab-case.md`

5. **Follow catalog rules for repo entries.** If you analyzed a repo:
   - Every claim needs `file:line` evidence from actual source code
   - Use `/analyze-repo <name>` for full deep-dive analysis
   - For quick updates to existing entries, edit directly with evidence

6. **Link properly.** Use relative paths. Link to related docs on first mention. Cross-link catalog entries with architecture docs where relevant.

7. **Mark gaps explicitly.** If you found something you couldn't fully answer:
   - `_TODO_` — gap fillable by reading code or docs
   - `_TBD: confirm with [team]_` — requires human input

### Catalog entry updates

If you worked with source code from any the company repo, check if the catalog entry needs updating:

```bash
# Find the catalog entry
find catalog/repos -type d -name "<repo-name>"

# If no entry exists, create one with /analyze-repo
# If entry exists, read it and update what changed
```

Update these fields when you have new evidence:
- Status changes (production → sunset, unknown → production)
- New dependencies discovered
- Architecture patterns confirmed or corrected
- Security findings
- Team/ownership changes

---

## Phase 2: Quality Verification

After making updates, verify quality:

### Checklist

- [ ] Every fact I added was verified this session (code, logs, or testing)
- [ ] I read existing docs before modifying them
- [ ] I didn't duplicate information already present elsewhere
- [ ] I removed or corrected any stale/wrong content I found
- [ ] All modified files have updated `last-updated` in frontmatter
- [ ] New files have complete YAML frontmatter
- [ ] All file paths and references I mentioned are current
- [ ] Cross-links between related docs are in place
- [ ] No secrets, credentials, or sensitive data in any file

### Verify links and gaps

```bash
# Check for broken internal links in files you modified
# (manually verify relative paths resolve)

# Check gap markers you added
grep -r "_TODO_\|_TBD:" --include="*.md" <files-you-changed>
```

### Report to user

Summarize what you updated:

1. **Files modified** — list each file and what changed
2. **Files created** — list new files with their purpose
3. **Corrections made** — what was wrong before and what you fixed
4. **Gaps marked** — any `_TODO_` or `_TBD:` markers you added
5. **Suggestions** — things that need human input or deeper investigation
