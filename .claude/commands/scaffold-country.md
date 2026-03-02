# Scaffold New Country

Add a new country to the regime change analysis project and create all 20 raw data YAML files.

## Skills Referenced
- `country-config`: Config format and valid field values
- `pipeline`: scaffold.py arguments and expected output

## Input

The user will provide:
- **country_id** — snake_case country identifier (e.g., `gambia_test`, `zambia`)
- Optionally: name, region, category, regime_change_years, time_range override

If any required fields are missing, ask before proceeding.

## Process

### Step 1 — Check if country already exists

Read `data/config/countries.yaml` and check whether `$ARGUMENTS` (the country_id) is already present.

If it already exists, stop and report: "Country `<id>` is already in countries.yaml. Run `/validate-data <id>` to check its current state."

### Step 2 — Gather country metadata

If the country is new, confirm the following with the user (or use provided values):

1. **Display name** — e.g., "The Gambia"
2. **Region** — one of: `mena`, `africa_violent`, `africa_peaceful`, `eastern_europe`, `asia`, `latin_america`
3. **Category** — one of the transition categories from `country-config` skill
4. **Regime change year(s)** — at least one year required
5. **time_range** — optional override; if not provided, auto-calculated as `(min_year - 15)` to current year

### Step 3 — Add entry to countries.yaml

Edit `data/config/countries.yaml` to add the new entry at the appropriate position in the file (group by region).

Minimal format:
```yaml
<country_id>:
  name: <display name>
  region: <region>
  category: <category>
  regime_change_years:
    - <YYYY>
```

### Step 4 — Run scaffold.py

```bash
python3 data/scripts/scaffold.py --country <country_id>
```

Report the output: how many files were created, which dimension directories were created.

### Step 5 — Verify

Check that the expected 20 files exist:
- `data/raw/<country_id>/political/` — 5 files
- `data/raw/<country_id>/economic/` — 5 files
- `data/raw/<country_id>/international/` — 5 files
- `data/raw/<country_id>/transparency/` — 5 files

Report: "Scaffolded `<country_id>`: 20 files created across 4 dimensions, years <start>–<end>."

### Step 6 — Next steps guidance

Tell the user:
- Run `/collect-data <country_id>` to fill in the data
- Run `/validate-data <country_id>` after collecting to check completeness

## Arguments

$ARGUMENTS
