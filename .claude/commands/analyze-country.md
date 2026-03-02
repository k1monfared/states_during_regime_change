# Analyze Country — Full End-to-End Workflow

Run the complete analysis pipeline for a single country: collect data, validate, score, and plot.

## Skills Referenced
- `country-config`: Read time_range and regime_change_years
- `pipeline`: All 4 scripts
- `data-schema`: YAML structure

## Input

Arguments: `<country_id> [year_range]`

Examples:
- `/analyze-country iraq`
- `/analyze-country tunisia 2010-2020`
- `/analyze-country gambia 2015-2026`

## Process

### Step 1 — Read country config

Read `data/config/countries.yaml` to get:
- Display name
- Regime change years
- Time range (explicit or calculated)
- Region and category

If the country is not in countries.yaml, stop and say: "Country `<id>` not found. Run `/scaffold-country <id>` first."

If `year_range` is provided, use it. Otherwise use the full country time range from config.

### Step 2 — Check data status

Run:
```bash
python3 data/scripts/validate.py --country <country_id>
```

Report current coverage. Ask the user:
> "Current data coverage is X%. Do you want to:
> (a) Fill in missing data first using /collect-data
> (b) Proceed to scoring with existing data only"

If coverage is 0% (all missing), default to (a) — run `/collect-data` first.

### Step 3 — Collect data (if needed or requested)

Invoke the collect-data workflow:
> "Running /collect-data <country_id> [year_range]..."

Follow the collect-data command process to fill in all indicators for the specified year range.

### Step 4 — Validate

After collection (or if proceeding with existing data):
```bash
python3 data/scripts/validate.py --country <country_id>
```

Surface any critical errors. If critical errors exist, list them and ask whether to fix before proceeding.

### Step 5 — Generate scores

```bash
python3 data/scripts/generate_scores.py --country <country_id> --verbose --only-scored
```

Report score summary per Step 4 of generate-scores command.

### Step 6 — Plot

Generate three standard plots:

```bash
# 1. All dimensions over time
python3 data/scripts/plot_data.py --countries <country_id> --show-dimensions \
  --output plots/<country_id>_dimensions.png

# 2. Composite score (regime-change-aligned)
python3 data/scripts/plot_data.py --countries <country_id> --align-regime-change \
  --output plots/<country_id>-regime-change-aligned.png

# 3. Indicator heatmap (political dimension)
python3 data/scripts/plot_data.py --countries <country_id> --dimension political \
  --plot-type heatmap --output plots/<country_id>_political_heatmap.png
```

### Step 7 — Narrative summary

Produce a brief narrative (3–5 paragraphs):
1. **Context**: Country, regime change year(s), transition type
2. **Trajectory**: Overall composite score trend — improving, declining, U-shaped, flat
3. **Strongest dimension**: Which dimension scores highest and why
4. **Weakest dimension**: Which dimension lags and key indicators dragging it down
5. **Notable turning points**: Years with sharp score changes and what happened

## Arguments

$ARGUMENTS
