# .claude/meta — Meta Documentation

This directory contains persistent documentation about the Claude Code skill system for this project.

## Contents

| File | Description |
|------|-------------|
| `skills.log` | Full skill inventory, dependency map, source→indicator routing table, improvement workflow |
| `skills.md` | Markdown version of skills.log (generated; do not edit directly) |
| `learnings/` | Per-skill observations from real sessions; feeds the `improve-skill` meta-skill |

## Regenerating skills.md

```bash
loglog .claude/meta/skills.log > .claude/meta/skills.md
```

## The learnings/ Directory

One file per skill or command, created on demand. Format:

```markdown
## YYYY-MM-DD
- What worked well
- What was confusing or missing
- Edge case encountered
```

After any session where you notice a gap in a skill, append a note here. Run `/improve-skill <name>` periodically to incorporate accumulated learnings into the skill file.

Current entries: `collect-data.md`, `source-qualitative.md`

## Skill System Overview

```
Layer 4 (Meta-Mgmt) skill-management
                         orchestrates ↓
                    skill-audit, cross-skill-patterns, synthesize-learnings
                         ↑ analyses and improves ↑
Layer 3 (Meta)      improve-skill, create-skill
                         ↑ iterates on ↑
Layer 2 (Commands)  scaffold-country, validate-data, generate-scores,
                    analyze-country, compare, update-status
                         ↑ compose ↑
Layer 1 (General)   data-schema, pipeline, country-config
Layer 1 (Source)    source-worldbank, source-imf, source-conflict,
                    source-freedomhouse, source-rsf, source-openbudget,
                    source-wjp, source-eiti, source-unhcr, source-vdem,
                    source-qualitative
```

Layer 4 is **proactive** — it analyses the entire skill system theoretically without waiting for learnings to accumulate, using structural audits, cross-skill pattern extraction, and inference from analogous skills.

See `skills.log` for the full dependency map and source→indicator routing table.
