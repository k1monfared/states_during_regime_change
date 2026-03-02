---
name: cross-skill-patterns
layer: 4-meta-management
purpose: Read all skills and extract cross-cutting patterns, knowledge asymmetries, transferable insights, and redundancy
used_by: [skill-management]
composes: []
---

# Cross-Skill Pattern Extraction

Read all skill and command files holistically to find patterns that span multiple files — knowledge that should be shared but isn't, repeated warnings that indicate a common pitfall, and structural patterns that work well in some skills but are absent in others where they'd help.

## Usage

```
/cross-skill-patterns
```

No arguments. Always analyses all skills.

## Process

### Step 1 — Read all skills and commands

Read every file in:
- `.claude/skills/*/SKILL.md`
- `.claude/commands/*.md`

Build a mental model of the full skill corpus before identifying patterns.

### Step 2 — Find pattern types

Apply each of the following lenses:

---

#### Lens A: Repeated Warnings / Common Pitfalls

Look for warnings, "do not" rules, or cautionary notes that appear in multiple skills.

If the same warning appears in ≥2 skills, it is a **cross-skill pitfall** — a shared danger that may be under-documented in other related skills.

Example: if `source-imf` and `source-worldbank` both warn "conflict states have unreliable data", but `source-conflict` and `source-unhcr` don't mention cross-referencing with WB/IMF for context — that's an asymmetry.

Output pattern entry:
```
Pattern: Conflict-state data gaps
Appears in: source-imf, source-worldbank
Missing from: source-conflict, source-unhcr, source-vdem
Recommendation: Add "conflict state data reliability" note to missing skills
```

---

#### Lens B: Knowledge Asymmetries

Skill A knows something that Skill B needs but doesn't have.

Look for: a source skill that documents how to handle a specific country type (e.g., new states, authoritarian), while a related skill covers the same countries but has no equivalent guidance.

Also: a command references a skill but the skill doesn't acknowledge the command's use case.

Output:
```
Asymmetry: source-qualitative documents ICG report navigation; source-freedomhouse
           also uses qualitative assessment for missing years but has no guidance
           on where to find qualitative FH supplements.
Transfer: Move ICG/qualitative-source guidance to a shared note in data-schema or
          create a source-fallback-qualitative section.
```

---

#### Lens C: Extractable Shared Primitives

If 3+ skills contain similar blocks (citation format boilerplate, scale conversion tables, coverage gap patterns), that repeated content is a candidate for extraction into a shared skill or a standard section in `data-schema`.

Look for: citation format blocks, reliability rating tables, "when data is absent" sections.

Output:
```
Redundancy: Citation format blocks appear in 11 source-* skills with identical structure.
            The format itself is already in data-schema. The source skills could reference
            data-schema instead of repeating the full block.
Action: Trim citation boilerplate from source skills; add pointer to data-schema.
```

---

#### Lens D: Structural Patterns That Work

Look for sections, formats, or structural choices that make some skills clearer than others.

Examples:
- A skill that has a "Quick Lookup Steps" section at the end that makes it faster to use
- A skill with a comparison table that replaces paragraphs of prose
- A command that has a clear prerequisite check that prevents silent failures

Identify which skills have these patterns and which would benefit from them.

Output:
```
Good pattern: source-worldbank "Quick Lookup Steps" section
Missing from: source-imf, source-vdem, source-unhcr (all have multi-step access processes)
Recommendation: Add equivalent Quick Lookup section to those three skills
```

---

#### Lens E: Vocabulary / Concept Inconsistencies

Look for the same concept described differently across skills:
- Different names for the same thing (e.g., "data gap" vs. "missing data" vs. "coverage gap")
- Conflicting guidance (skill A says reliability:high for X; skill B implies reliability:medium)
- Units or scale described differently for the same indicator

Output:
```
Inconsistency: "coverage gap" used in pipeline, "data gap" in source-imf, "missing data" in data-schema
Recommendation: Standardize on "data gap" (most specific); update data-schema as canonical definition
```

---

#### Lens F: Skill Graph Completeness

Draw the dependency graph from skills.log and check:
- Are there skills referenced in `used_by` that don't actually mention their dependents?
- Are there commands that compose skills without the skill knowing about it?
- Are there orphan skills (layer 1) with no layer 2 commands using them?

Output:
```
Graph gap: source-openbudget lists used_by: [collect-data] but collect-data's routing
           table references it — the link is directionally correct but source-openbudget
           is not mentioned in collect-data's "Skills Referenced" section.
```

---

### Step 3 — Rank patterns by impact

Score each identified pattern:
- **High**: affects ≥5 skills OR blocks a core workflow OR creates incorrect output
- **Medium**: affects 2–4 skills OR creates confusion without blocking
- **Low**: affects 1 skill OR cosmetic inconsistency

### Step 4 — Produce the pattern report

```
## Cross-Skill Pattern Report — <date>

### High-Impact Patterns (N)
1. <pattern name>
   Affects: <skills>
   Type: <asymmetry|redundancy|pitfall|structural|vocabulary|graph>
   Recommendation: <action>

### Medium-Impact Patterns (N)
...

### Low-Impact Patterns (N)
...

### Transferable Knowledge Summary
Top 3 pieces of knowledge that should be propagated:
1. ...
2. ...
3. ...

### Skills That Could Be Simplified (redundancy)
- <skill>: <what could be removed/referenced instead>
```

## Arguments

$ARGUMENTS
