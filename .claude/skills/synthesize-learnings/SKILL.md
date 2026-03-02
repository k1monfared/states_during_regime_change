---
name: synthesize-learnings
layer: 4-meta-management
purpose: Meta-analyse all learnings files holistically; extract cross-cutting themes; hypothesize improvements for skills with no learnings yet
used_by: [skill-management]
composes: [cross-skill-patterns]
---

# Synthesize Learnings

Read all `.claude/meta/learnings/*.md` files and perform a meta-analysis — not just extracting what each skill needs, but finding themes that cut across skills, inferring what undocumented skills likely need based on analogy, and generating theoretical improvement hypotheses.

The key distinction from `improve-skill`: that skill improves one file using one learning file. This skill synthesizes *all* learnings *across all skills* to find patterns that individual improvement cycles would miss.

## Usage

```
/synthesize-learnings
```

No arguments. Always analyses all learnings.

## Process

### Step 1 — Read all learnings files

Glob `.claude/meta/learnings/*.md` and read every file.

For each entry in each file, extract and tag:
- **Skill name**: which skill this learning belongs to
- **Date**: when it was recorded
- **Type**: one of `gap` (missing content), `confusion` (ambiguous instruction), `edge_case` (scenario not handled), `outdated` (stale info), `friction` (unnecessary complexity), `worked_well` (positive pattern to preserve)
- **Scope**: `local` (specific to this skill only) or `generalizable` (likely applies to ≥1 other skill)
- **Summary**: one line

Build a tagged learning corpus.

### Step 2 — Find cross-cutting themes

Group generalizable learnings by theme. Look for:

**Theme types:**
- **Access friction**: Multiple skills have learnings about hard-to-navigate data portals → a shared access tip section could help
- **Conflict-state exceptions**: Multiple skills have learnings about data gaps in conflict countries → shared handling guidance
- **Confidence calibration**: Multiple skills' learnings suggest Claude over-assigns `confidence: high` → systematic bias to address
- **Citation completeness**: Repeated learnings about missing URL or access_date → structural gap in citation guidance
- **Feature vocabulary confusion**: Learnings about picking wrong feature tags → may indicate vocabulary itself is ambiguous
- **Year alignment**: Learnings about fiscal years, survey years, or lag in datasets → timing issues across multiple sources

For each theme found, list: which skills contributed learnings, what the pattern is, and which other skills likely have the same issue.

### Step 3 — Hypothesize for skills without learnings

For every skill/command that has **no learnings file**, apply inference:

1. **Analogy inference**: Does this skill's task resemble a skill that *does* have learnings? If yes, hypothesize that similar issues apply.
   - Example: `source-wjp` has no learnings. `source-openbudget` has a learning about biennial interpolation. `source-wjp` also has a gap-year problem (2011, 2012) — likely the same interpolation confusion applies.

2. **Structural inference**: Does this skill have a structure (scale conversion, conflict-state handling, multi-step access) known to generate confusion in other skills? Hypothesize issues.

3. **Usage frequency inference**: Skills used in every `/collect-data` run are used more often → more likely to have undocumented friction. Hypothesize that high-use skills have unrecorded learnings.

Output per undocumented skill:
```
source-vdem (no learnings file)
  Hypotheses:
  - [analogy: source-freedomhouse] Likely confusion about which year's V-Dem release
    covers which calendar year (V-Dem publishes in spring covering prior year).
  - [structural: 0-1 scale] The ×100 conversion may be forgotten; needs worked example.
  - [analogy: source-openbudget] Uncertainty bands (HDI intervals) may be under-used;
    learnings from openbudget suggest users skip optional quality signals.
  Priority: medium (high-use source for institutional_functioning)
```

### Step 4 — Identify learning debts

A **learning debt** is a skill that has been used many times in `collect-data` sessions but has no learnings file — meaning session friction is going undocumented.

Identify learning debts by checking:
- Skills in the source routing table (used in every data collection session)
- Skills with no learnings file

These are the highest-priority skills for the next `/collect-data` session to start logging.

### Step 5 — Produce the synthesis report

```
## Learnings Synthesis Report — <date>

### Learning Corpus
Files read: N
Total entries: N
Generalizable: N (X%)

### Cross-Cutting Themes

#### Theme 1: <name> (High/Medium/Low impact)
Skills with documented learnings: <list>
Skills likely affected (inferred): <list>
Synthesized insight: <what the theme means for the skill system>
Recommended action: <update data-schema | add shared note | propagate to N skills>

#### Theme 2: ...

### Hypotheses for Undocumented Skills (N skills)
| Skill | Basis | Hypotheses | Priority |
|-------|-------|-----------|---------|
| source-vdem | analogy+structural | year lag, scale conversion | medium |
| ...

### Learning Debts (high-use, no learnings file)
1. <skill> — used in every collect-data session; start logging
2. ...

### Positive Patterns to Preserve
These learning entries noted things that work well and should not be changed:
- source-qualitative: ICG reports are the most useful single source for territorial_control
- collect-data: Conservative confidence assignment prevents overstating data quality

### Recommended Next Actions
1. Propagate Theme 1 fix to: <skills> (high impact, quick)
2. Create learnings file for: <high-debt skills>
3. Run /improve-skill on: <skills with most hypotheses confirmed by pattern analysis>
```

## Arguments

$ARGUMENTS
