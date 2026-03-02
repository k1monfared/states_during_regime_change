# Validate Raw Data

Run the validation script and produce a clear summary of data quality issues.

## Skills Referenced
- `pipeline`: validate.py arguments and output interpretation

## Input

Arguments: `[--country <country_id>]`

If no country is specified, validate all countries.

## Process

### Step 1 — Run the script

```bash
python3 data/scripts/validate.py $ARGUMENTS
```

Capture full output.

### Step 2 — Parse the output

Extract these metrics for each country validated:
- Overall coverage % (complete + partial years / total years)
- Count of complete, partial, and missing year entries
- Count of critical errors (schema violations, invalid feature tags, YAML parse errors)
- Count of warnings (missing quantitative values, low confidence, missing sources)

### Step 3 — Prioritize issues

**Critical (must fix before scoring)**:
- YAML parse errors
- Invalid feature tags (not in valid_features vocabulary)
- Missing required fields (data_status absent)
- Duplicate year entries

**Warnings (scoring will proceed but quality is reduced)**:
- `quantitative.value` is null but `data_status: complete`
- `confidence: low` with no explanation in notes
- Missing source citations
- `data_status: partial` with no notes explaining what's missing

### Step 4 — Report

Format the output as a structured summary:

```
## Validation Summary — <country_id>

Coverage: <X>% (<complete> complete, <partial> partial, <missing> missing out of <total> years)

### Critical Errors (<N>)
- <file>: <error description>
- ...

### Warnings (<N>)
- <file>: <warning description>
- ...

### Next Steps
- Fix critical errors first, then re-run: python3 data/scripts/validate.py --country <id>
- For missing data: run /collect-data <id>
```

If no issues found:
```
Validation passed for <country_id>. Coverage: <X>%. Ready to score.
```

### Step 5 — For multi-country runs

Produce a cross-country table:
```
| Country | Coverage % | Critical | Warnings |
|---------|-----------|---------|---------|
| iraq    | 78%       | 0       | 12      |
| ...
```

Flag any country with coverage < 50% or any critical errors.

## Arguments

$ARGUMENTS
