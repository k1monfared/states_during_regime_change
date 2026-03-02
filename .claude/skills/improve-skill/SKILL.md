---
name: improve-skill
layer: 3-meta
purpose: Review and propose improvements to any existing skill or command file
used_by: []
composes: [any skill or command + meta/learnings/<name>.md]
---

# Improve Skill

Review an existing skill or command, incorporate documented learnings, and propose a revised version.

## Usage

```
/improve-skill <skill-or-command-name>
```

Examples:
- `/improve-skill collect-data`
- `/improve-skill source-qualitative`
- `/improve-skill validate-data`

## Input

`$ARGUMENTS` — the name of the skill or command to improve.

## Process

### Step 1 — Locate the file

Determine which file to improve:
- If it matches a command name: `.claude/commands/<name>.md`
- If it matches a skill name: `.claude/skills/<name>/SKILL.md`

Read the file in full.

### Step 2 — Read learnings (if available)

Check whether `.claude/meta/learnings/<name>.md` exists.

If it exists, read it. Extract all documented:
- Edge cases encountered
- Instructions that were confusing or ambiguous
- Missing coverage (scenarios the skill didn't handle)
- Outdated information
- What worked well (preserve these)

If no learnings file exists, work only from the skill text.

### Step 3 — Analyze the current skill

Review for:

1. **Clarity**: Are instructions unambiguous? Could any step be misinterpreted?
2. **Completeness**: Are there obvious missing cases? (compare against what the skill is supposed to do)
3. **Accuracy**: Is any information outdated (URLs, tool versions, methodology)?
4. **Redundancy**: Are any sections repeated or contradictory?
5. **Composability**: Does the skill properly reference other skills it depends on?
6. **Format**: Is the YAML frontmatter complete? Are code blocks formatted correctly?
7. **Examples**: Are examples realistic and correct?

### Step 4 — Propose changes

Present a **tracked changes summary**:

```
## Proposed Changes to <name>

### From learnings:
- [Learning date] Edge case: <situation> → Adding handling for this in Step X
- [Learning date] Confusion: <instruction> → Rewriting for clarity

### From review:
- Step 3 references an outdated URL → Updated to current URL
- Missing: no guidance for <scenario> → Added new section
- Redundant: Steps 4 and 6 both describe the same validation → Merged

### Preserved:
- Core workflow (Steps 1–5) is clear and complete
- Examples are accurate
```

### Step 5 — Write immediately

Write the improved file to disk without asking for confirmation.

If a `meta/learnings/<name>.md` existed, append an entry noting when the improvement was applied:
```
## <date>
- Applied improvements from learnings: <brief description of changes made>
```

Report what was changed:
```
Updated `.claude/skills/<name>/SKILL.md`:
- <change 1>
- <change 2>
```

## What NOT to Do

- Do not add complexity for its own sake — simpler is better
- Do not change the core purpose of a skill
- Do not invent problems that don't exist in the skill

## Arguments

$ARGUMENTS
