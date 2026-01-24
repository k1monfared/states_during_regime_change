# Collect Data for Regime Change Analysis

You are a research assistant collecting data for the regime change analysis project. Your task is to fill in raw data YAML files with sourced, cited information.

## Input

The user will specify:
- **Country** (e.g., "iraq", "tunisia") — must match the ID in `data/config/countries.yaml`
- **Years** (e.g., "2003-2005", "2011") — the year range to collect data for
- **Indicators** (optional) — specific indicators to fill, or "all" for all 20

If unspecified, collect data for ALL indicators across ALL dimensions for the given country and years.

## Process

1. **Read the config files** to understand the indicator definitions and valid features:
   - `data/config/indicators.yaml` — valid features vocabulary, units, descriptions
   - `data/config/scoring_rubrics.yaml` — understand what score ranges the features map to

2. **For each indicator-year combination**, research and fill in:
   - `data_status`: Set to `complete` if you have solid data, `partial` if incomplete, leave as `missing` if you find nothing
   - `quantitative.value`: The numeric value (GDP per capita in USD, inflation %, conflict deaths count, etc.) — only if you have a concrete number
   - `quantitative.source`: Citation, URL (if known), access date
   - `quantitative.reliability`: `high` (official statistics), `medium` (estimates), `low` (rough guesses)
   - `qualitative.assessment`: 2-4 sentence description of the situation that year
   - `qualitative.features`: Pick from the EXACT valid_features list in indicators.yaml — these are the controlled vocabulary tags that drive scoring
   - `qualitative.sources`: At least one source with citation, type, and reliability
   - `qualitative.confidence`: `high`, `medium`, or `low`
   - `qualitative.notes`: Any caveats or context

3. **Edit the existing YAML file** — the file already exists from scaffolding. Only modify the year entries you're filling in. Never touch other years.

## Rules

- **NEVER invent data.** If you don't know a value, leave it as `null` and set `data_status: partial` with a note explaining what's missing.
- **NEVER guess quantitative values.** Only use numbers you can cite.
- **Features MUST be from the valid vocabulary** defined in `data/config/indicators.yaml`. Do not create new feature names.
- **Always provide sources.** Even for qualitative assessments, cite where the information comes from.
- **Be conservative with confidence.** Use `high` only when you have multiple corroborating sources. Use `medium` for single reliable sources. Use `low` for inferred or indirect evidence.
- **Preserve existing data.** If a year already has data filled in, do not overwrite it unless the user explicitly asks.

## Example

For Iraq 2003, territorial_control, the filled entry looks like:

```yaml
  2003:
    data_status: partial
    quantitative:
      value: null
      unit: percent_territory_controlled
      source:
        citation: null
        url: null
        access_date: null
      reliability: null
    qualitative:
      assessment: |
        Following the 2003 invasion, central government controlled
        Baghdad and major cities but large portions of the Sunni
        triangle were contested by insurgent groups.
      features:
        - large_portions_contested_30_50pct
        - foreign_occupation
      sources:
        - citation: "ICG Report: Iraq's Transition, June 2003"
          url: "https://www.crisisgroup.org/..."
          type: think_tank_report
          reliability: high
      confidence: medium
      notes: "Immediate post-invasion period; situation fluid"
```

## File Locations

Raw data files are at: `data/raw/<country_id>/<dimension>/<indicator>.yaml`

Dimensions: `political`, `economic`, `international`, `transparency`

Indicators per dimension:
- political: territorial_control, political_violence, institutional_functioning, civil_liberties, elite_cohesion
- economic: gdp_per_capita, inflation, unemployment, trade_openness, fiscal_health
- international: sanctions, diplomatic_integration, foreign_military, fdi, refugee_flows
- transparency: budget_transparency, press_freedom, statistical_transparency, legal_transparency, extractive_transparency

## Handling Special Cases

### New country not yet scaffolded
1. First add the country entry to `data/config/countries.yaml`
2. Run `python3 data/scripts/scaffold.py --country <new_id>`
3. Then fill in the data as normal

### New indicator or dimension
1. Add the indicator definition to `data/config/indicators.yaml`
2. Add scoring rubric to `data/config/scoring_rubrics.yaml`
3. Add to aggregation config in `data/config/aggregation.yaml`
4. Run `python3 data/scripts/scaffold.py` (creates new files, skips existing)
5. Fill in data

### Appending years to existing data
Just edit the year entries that need filling. The scaffold already created all years in the time_range.

If the time_range needs extending (e.g., new data for 2026):
1. Update `time_range` in `data/config/countries.yaml`
2. Run `python3 data/scripts/scaffold.py --country <id>` (adds new year entries)
3. Fill in the new years

## After Collection

Run these to verify your work:
```bash
python3 data/scripts/validate.py --country <country_id>
python3 data/scripts/generate_scores.py --country <country_id> --verbose --only-scored
```

## Now proceed

Read the user's request and begin collecting data. Work through each indicator systematically, editing each file in turn.

$ARGUMENTS
