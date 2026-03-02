# Generate Scores

Run the scoring script and summarize results.

## Skills Referenced
- `pipeline`: generate_scores.py arguments, output format, and CSV schema

## Input

Arguments: `[--country <country_id>] [--verbose] [--only-scored]`

If no country specified, scores all countries.

## Process

### Step 1 — Check prerequisites

Before running, verify:
1. Score file(s) exist or will be created at `data/derived/scores/<country_id>.csv`
2. Raw YAML files exist for the target country (if not, suggest running `/scaffold-country` first)

If raw data is not yet filled (all `data_status: missing`), warn the user but proceed.

### Step 2 — Run the script

```bash
python3 data/scripts/generate_scores.py $ARGUMENTS
```

If no `--verbose` flag is passed by the user, add it to see per-indicator output:
```bash
python3 data/scripts/generate_scores.py $ARGUMENTS --verbose --only-scored
```

### Step 3 — Parse and summarize output

Extract from verbose output:
- Which countries were scored
- For each country: score range (min/max composite across years)
- Dimension averages (political, economic, international, transparency)
- Years with missing data warnings (indicators that had no features to score)
- Any scoring errors

### Step 4 — Report

```
## Score Summary — <country_id>

Output: data/derived/scores/<country_id>.csv

Composite score range: <min> – <max> (across <N> years with data)
Best year: <YYYY> (<score>)
Worst year: <YYYY> (<score>)

Dimension averages (all scored years):
  Political:      <avg>
  Economic:       <avg>
  International:  <avg>
  Transparency:   <avg>

Missing data warnings: <N> indicator-years had no features → scored as null
  - Example: territorial_control 2021: no features found

Next step: run /plot-data to visualize
```

### Step 5 — Multi-country summary

If multiple countries scored, add a comparison table:
```
| Country | Years Scored | Composite Range | Best Year | Worst Year |
|---------|-------------|----------------|-----------|-----------|
| iraq    | 23          | 28.4 – 62.1    | 2016      | 2006      |
```

## Arguments

$ARGUMENTS
