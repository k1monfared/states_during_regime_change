---
name: create-skill
layer: 3-meta
purpose: Draft a new skill or command from a task description, following project conventions
used_by: []
composes: [all skills/commands as reference patterns]
---

# Create Skill

Draft a new skill or command file from a natural language description of the task.

## Usage

```
/create-skill "<description of the task this skill should perform>"
```

Examples:
- `/create-skill "summarize all missing data across all countries into a report"`
- `/create-skill "compare two specific years for a country side by side"`
- `/create-skill "export scores to JSON format"`

## Input

`$ARGUMENTS` — a natural language description of what the new skill should do.

## Process

### Step 1 — Understand the task

From the description, identify:
1. **Inputs**: What arguments or data does this skill take?
2. **Outputs**: What does it produce (file, report, terminal output, file modification)?
3. **Steps**: What is the high-level process?
4. **Tools needed**: Which scripts, commands, or external tools does it use?

If the description is ambiguous, ask one clarifying question before proceeding.

### Step 2 — Check for overlap

Scan existing skills and commands:
- `.claude/skills/*/SKILL.md`
- `.claude/commands/*.md`

If an existing skill already covers this task (even partially), report:
> "The skill `<name>` already covers <overlap>. Consider using `/improve-skill <name>` to extend it instead of creating a new one."

Only proceed to create a new file if the task is genuinely new.

### Step 3 — Determine placement

| If the task is... | Place it in... |
|-------------------|---------------|
| General, reusable across projects | `.claude/skills/<name>/SKILL.md` |
| Project-specific workflow | `.claude/commands/<name>.md` |
| A data source reference | `.claude/skills/source-<name>/SKILL.md` |
| A meta-operation on skills | `.claude/skills/<name>/SKILL.md` |

Choose a name:
- Commands: verb-noun pattern, lowercase, hyphenated (e.g., `export-scores`, `missing-report`)
- Skills: descriptive noun or source prefix (e.g., `source-polity`, `data-merge`)

### Step 4 — Draft the file

**For a command** (`.claude/commands/<name>.md`):
```markdown
# <Title>

<One-sentence purpose>

## Skills Referenced
- `<skill>`: <why it's used>

## Input

Arguments: ...

## Process

### Step 1 — ...
### Step 2 — ...
...

## Arguments

$ARGUMENTS
```

**For a skill** (`.claude/skills/<name>/SKILL.md`):
```markdown
---
name: <name>
layer: <1-general|1-source|2-specialized|3-meta>
purpose: <one-line description>
used_by: [list of commands/skills that use this]
---

# <Title>

## What It Covers

...

## Process / Reference

...
```

Follow the patterns established by existing files in this project (see `source-worldbank`, `pipeline`, `scaffold-country` for reference).

### Step 5 — Check composability

Does this skill compose existing general skills? If so, reference them explicitly in the file.

Does this skill need to be referenced by an existing command? If so, suggest updating that command to add a "Skills Referenced" link.

### Step 6 — Write immediately

Write the file to disk without asking for confirmation. Report the file path created.

### Step 7 — Update skills.log

After writing the file, append an entry to `.claude/meta/skills.log`:
```
    - <name>: <purpose> [<date added>]
        - Layer: <layer>
        - File: <path>
        - Composes: [list]
```

## What Makes a Good Skill

- Clear, specific scope — does one thing well
- Uses `$ARGUMENTS` for input
- References existing skills rather than duplicating them
- Has at least one worked example
- Explains edge cases and what to do when things go wrong
- For source skills: always includes citation format, scale/unit, coverage gaps, reliability

## Arguments

$ARGUMENTS
