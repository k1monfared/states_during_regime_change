---
name: skill-management
layer: 4-meta-management
purpose: Full skill system health analysis — orchestrates audit, pattern extraction, and learnings synthesis into a unified report with prioritised improvement actions
used_by: []
composes: [skill-audit, cross-skill-patterns, synthesize-learnings, improve-skill]
---

# Skill Management

The top-level orchestrator for proactive skill system improvement. Rather than waiting for problems to surface through individual learnings, this skill runs a full theoretical analysis of the skill system — structural quality, cross-skill patterns, and learning debts — and produces a prioritised action plan.

It can also act on that plan directly by invoking `improve-skill` on the highest-priority targets.

## Usage

```
/skill-management [--act]
```

- No flag: produce the health report only
- `--act`: after the report, automatically run `/improve-skill` on the top 3 highest-priority skills

## Process

### Step 1 — Run structural audit

Invoke `skill-audit` (no argument — full audit):

Collect:
- Per-file scores and missing sections
- Broken cross-references
- Files not in skills.log
- Learnings coverage map

### Step 2 — Extract cross-skill patterns

Invoke `cross-skill-patterns`:

Collect:
- Ranked list of patterns (high/medium/low impact)
- Knowledge asymmetries and transferable insights
- Redundancy candidates
- Vocabulary inconsistencies
- Dependency graph gaps

### Step 3 — Synthesize learnings

Invoke `synthesize-learnings`:

Collect:
- Cross-cutting themes from documented learnings
- Hypotheses for undocumented skills (by analogy and structural inference)
- Learning debts (high-use skills with no learnings file)
- Positive patterns to preserve

### Step 4 — Build the unified priority list

Combine all findings into a single ranked improvement list.

**Scoring formula** for each candidate improvement:

| Signal | Points |
|--------|--------|
| Structural audit score < 50% | +3 |
| Identified in a high-impact cross-skill pattern | +3 |
| Identified in a high-impact cross-cutting theme | +3 |
| Has documented learnings waiting to be applied | +2 |
| Has a confirmed learning debt (high-use, no learnings) | +2 |
| Has theoretical hypotheses (≥3 inferred issues) | +1 |
| Referenced by many other skills (hub skill) | +1 |

Sort candidates by total score descending. Break ties: prefer hub skills (affect more dependents).

### Step 5 — Produce the Skill System Health Report

```
## Skill System Health Report — <date>

### Overall Health
Skills analysed: N
Average structural score: X% (target: ≥80%)
Skills below 50%: N
High-impact patterns found: N
Learning debts: N skills

### Priority Improvement Queue

Rank | Skill/Command          | Score | Primary reasons
-----|------------------------|-------|----------------
1    | source-vdem            |  9    | Structural 40%, learning debt, 4 inferred issues
2    | collect-data           |  8    | Learning file has 6 unactioned entries, hub skill
3    | data-schema            |  7    | Vocabulary inconsistency (3 patterns), no examples
...

### Cross-Skill Insights (Top 3)

1. <Theme/Pattern name>
   Affects: <N skills>
   Action: <specific change needed>

2. ...

3. ...

### Learning Debts (act on these next session)
Skills used frequently with no learnings file:
- source-imf
- source-wjp
- ...
Start appending observations to .claude/meta/learnings/<name>.md during next use.

### Skills Ready to Improve Now (have learnings + structural gaps)
- collect-data: 6 learnings entries, structural score 62%
- source-qualitative: 7 learnings entries, structural score 71%

### Theoretical Improvements (no learnings yet, but inferred)
- source-vdem: year-lag confusion, scale conversion omission, uncertainty bands
- source-rsf: methodology break guidance incomplete, pre-2002 fallback unclear
- ...

### What's Working Well (preserve)
- source-qualitative: ICG as primary source is well-documented; preserve
- collect-data: conservative confidence guidance is a genuine quality safeguard
- pipeline: error table format is clear; replicate in other scripts-referencing skills

### Recommended Actions (in order)
1. Run /improve-skill collect-data  (high impact; 6 learnings ready to apply)
2. Run /improve-skill source-qualitative  (7 learnings ready)
3. Propagate conflict-state data gap guidance to: source-imf, source-vdem, source-unhcr
4. Add learnings file for source-imf (highest learning debt)
5. Run /skill-audit source-vdem → then /improve-skill source-vdem
```

### Step 6 — Act (if `--act` flag)

If `--act` was passed, automatically run `/improve-skill` on the top 3 ranked skills from the priority queue. Report each as it completes.

### Step 7 — Update skills.log

Append a dated entry to `.claude/meta/skills.log`:
```
    - Skill Management Run: <date>
        - Skills analysed: N
        - Average structural score: X%
        - Top priority: <skill>
        - Actions taken: [none | improved <list>]
```

## Self-Application

This skill is itself subject to `skill-management`. Because it sits at layer 4, it will appear in its own audit output. That's intentional — the skill system should be self-improving.

When `skill-management` identifies issues with `skill-audit`, `cross-skill-patterns`, `synthesize-learnings`, or itself, use `/improve-skill <name>` to apply the fix. The meta-layer improves along with the skills it manages.

## How Often to Run

- **After a major skill creation session** (like the initial build): run once to establish the baseline health score
- **After 5+ data collection sessions**: enough new learnings may have accumulated
- **When a workflow feels broken or inconsistent**: run to diagnose systemic issues
- **Periodically** (every few months of active use): to catch drift

## Arguments

$ARGUMENTS
