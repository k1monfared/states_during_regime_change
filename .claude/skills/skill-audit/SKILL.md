---
name: skill-audit
layer: 4-meta-management
purpose: Structural analysis of all skill and command files; scores completeness, flags broken references, identifies missing sections
used_by: [skill-management]
composes: []
---

# Skill Audit

Read every skill and command file and score each one against a structural completeness rubric. This is a *structural* audit — it evaluates the quality of the skill documentation itself, not whether the underlying process is good.

## Usage

```
/skill-audit [<name>]
```

- No argument: audit all skills and commands
- With name: audit a single skill or command

## Process

### Step 1 — Build the file inventory

Read `.claude/meta/skills.log` to get the full list of skills and commands. Also glob for any files not in skills.log:
- `.claude/skills/*/SKILL.md`
- `.claude/commands/*.md`

Flag any files found by glob but absent from skills.log — these are undocumented skills.

### Step 2 — Score each file

Apply this rubric to each file. Score each criterion 0 (absent) or 1 (present):

**For all files:**
| Criterion | Weight |
|-----------|--------|
| Has a clear one-sentence purpose statement | 1 |
| Has explicit input/argument documentation | 1 |
| Has step-by-step process (≥3 steps) | 1 |
| Has at least one worked example or sample output | 2 |
| References other skills it depends on | 1 |
| Has edge case / error handling guidance | 2 |
| Uses `$ARGUMENTS` for parameterization | 1 |

**Additional for SKILL.md files (skills):**
| Criterion | Weight |
|-----------|--------|
| Has valid YAML frontmatter (name, layer, purpose, used_by) | 1 |
| `used_by` list matches actual usage in commands | 1 |
| Layer assignment is correct (1/2/3/4) | 1 |

**Additional for source-* skills:**
| Criterion | Weight |
|-----------|--------|
| Has citation format with example | 2 |
| Has scale/unit and conversion formula if applicable | 2 |
| Has coverage gaps section | 2 |
| Has reliability rating | 1 |
| Crosswalk to feature vocabulary included | 2 |

**Additional for command files:**
| Criterion | Weight |
|-----------|--------|
| Lists referenced skills at top | 1 |
| Has prerequisite check step | 1 |
| Has output/reporting step | 1 |

### Step 3 — Check cross-references

For every skill or command referenced inside a file (e.g., "see `source-worldbank` skill"), verify the referenced file actually exists.

Flag: broken references (referenced but doesn't exist), stale references (referenced file has been renamed or moved).

### Step 4 — Check learnings coverage

For each skill/command, check whether `.claude/meta/learnings/<name>.md` exists.

Flag: skills with no learnings file — these are "blind spots" where session knowledge may be going undocumented.

### Step 5 — Produce the audit report

```
## Skill Audit Report — <date>

### Summary
Total files: N
Average score: X/Y (Z%)
Files with broken references: N
Files with no learnings: N

### Per-file Scores (sorted by score ascending — lowest first)
| File | Score | Missing |
|------|-------|---------|
| source-eiti | 8/18 | example, crosswalk, edge cases |
| ...          |      |         |

### Broken References
- skill-audit references `skill-patterns` — file does not exist

### Learnings Coverage
Skills with learnings:  collect-data, source-qualitative
Skills without learnings: [all others — N files]

### Top 5 Structural Priorities
1. <file> — missing: <list> (score: X/Y)
2. ...
```

## What This Is Not

- This audit does not evaluate whether the *content* is correct or up to date — that's `cross-skill-patterns` and `synthesize-learnings`
- It does not run the actual skills to test them
- It is purely static document analysis

## Arguments

$ARGUMENTS
