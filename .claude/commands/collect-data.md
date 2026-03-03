# Collect Data for Regime Change Analysis

You are a research assistant collecting data for the regime change analysis project. Your task is to fill in raw data YAML files with sourced, cited information.

## Input

The user will specify:
- **Country** (e.g., "iraq", "tunisia") — must match the ID in `data/config/countries.yaml`
- **Years** (optional, e.g., "2003-2005", "2011") — the year range to collect data for
- **Indicators** (optional) — specific indicators to fill, or "all" for all 20

If years are unspecified, use the country's full time range (auto-calculated as: `earliest_regime_change - 15` to `current_year`).

If indicators are unspecified, collect data for ALL indicators across ALL dimensions.

## Source Routing Table

For each indicator, consult the listed source skill for data sourcing guidance:

| Indicator | Primary Source Skill | Fallback |
|-----------|---------------------|---------|
| gdp_per_capita | `source-worldbank` | `source-imf` |
| inflation | `source-imf` | `source-worldbank` |
| unemployment | `source-worldbank` | — |
| trade_openness | `source-worldbank` | — |
| fiscal_health | `source-imf` | — |
| political_violence | `source-conflict` | `source-qualitative` |
| territorial_control | `source-qualitative` | `source-conflict` |
| institutional_functioning | `source-vdem` | `source-freedomhouse` |
| civil_liberties | `source-freedomhouse` | `source-vdem` |
| elite_cohesion | `source-qualitative` | `source-vdem` |
| sanctions | `source-qualitative` | — |
| diplomatic_integration | `source-qualitative` | — |
| foreign_military | `source-qualitative` | — |
| fdi | `source-worldbank` | — |
| refugee_flows | `source-unhcr` | — |
| net_migration | `source-iom` | `source-worldbank` |
| emigration_rate | `source-iom` | — |
| immigration_rate | `source-iom` | — |
| remittances | `source-worldbank` | — |
| brain_drain | `source-oecd-migration` | `source-worldbank` |
| total_population | `source-worldbank` | — |
| working_age_population | `source-worldbank` | `source-ilo` |
| labor_force_participation | `source-ilo` | `source-worldbank` |
| employment | `source-ilo` | `source-worldbank` |
| youth_unemployment | `source-worldbank` | `source-ilo` |
| informal_economy | `source-ilo` | — |
| political_stability | `source-wgi` | — |
| government_effectiveness | `source-wgi` | — |
| control_of_corruption | `source-wgi` | — |
| military_expenditure | `source-sipri` | `source-worldbank` |
| natural_resource_rents | `source-worldbank` | — |
| gini | `source-worldbank` | — |
| life_expectancy | `source-worldbank` | — |
| infant_mortality | `source-worldbank` | — |
| internet_users | `source-worldbank` | — |
| mobile_subscriptions | `source-worldbank` | — |
| health_expenditure | `source-worldbank` | — |
| education_expenditure | `source-worldbank` | — |
| budget_transparency | `source-openbudget` | — |
| press_freedom | `source-rsf` | `source-freedomhouse` |
| statistical_transparency | `source-worldbank` | — |
| legal_transparency | `source-wjp` | `source-qualitative` |
| extractive_transparency | `source-eiti` | — |

Source skill files live at `.claude/skills/source-<name>/SKILL.md`. Each covers: what to measure, access URLs, citation format, scale/unit, coverage gaps, and reliability.

> **Note for political_violence**: The death count → feature tag crosswalk is in the `source-conflict` skill — read that skill before picking feature tags.

## Process

0. **Collect shared base variables first** — before collecting any indicator, populate
   `data/raw/<country>/shared/base_variables.yaml` for the entire time range with:
   - `population` (World Bank SP.POP.TOTL)
   - `gdp_current_usd` (World Bank NY.GDP.MKTP.CD)
   - `cpi` (World Bank FP.CPI.TOTL)
   - `working_age_population` (World Bank SP.POP.1564.TO)

   These are denominators for many indicators. Collecting them once avoids redundant lookups.
   See `source-components` SKILL.md for the `shared/base_variables.yaml` schema.

1. **Read the config files** to understand the indicator definitions and valid features:
   - `data/config/indicators.yaml` — valid features vocabulary, units, descriptions
   - `data/config/scoring_rubrics.yaml` — understand what score ranges the features map to
   - `data/config/countries.yaml` — country's **time_range** and regime_change_years (read this before starting to determine the correct year range)

2. **For each indicator-year combination**, research and fill in:
   - `data_status`: Set to `complete` if you have solid data, `partial` if incomplete, leave as `missing` if you find nothing
   - `quantitative.value`: The numeric value (GDP per capita in USD, inflation %, conflict deaths count, etc.) — only if you have a concrete number
   - `quantitative.formula`: The expression that produces the value from its components (e.g., `"(exports_usd + imports_usd) / gdp_current_usd * 100"`). Required for all ratio/derived indicators.
   - `quantitative.source`: Citation, URL (if known), access date
   - `quantitative.reliability`: `high` (official statistics), `medium` (estimates), `low` (rough guesses)
   - `quantitative.components`: **Required** for all indicators with a formula. See `source-components` SKILL.md for per-indicator component lists, formulas, and roles. For components that are shared base variables (population, GDP, CPI, working_age_population), write `shared_ref: <variable_name>` instead of re-entering the value.
   - `qualitative.assessment`: 2-4 sentence description of the situation that year
   - `qualitative.features`: Pick from the EXACT valid_features list in indicators.yaml — these are the controlled vocabulary tags that drive scoring
   - `qualitative.sources`: At least one source with citation, type, and reliability
   - `qualitative.confidence`: `high`, `medium`, or `low`
   - `qualitative.notes`: Any caveats or context; include World Bank footnotes if applicable

3. **Edit the existing YAML file** — the file already exists from scaffolding. Only modify the year entries you're filling in. Never touch other years.

## Rules

- **NEVER invent data.** If you don't know a value, leave it as `null` and set `data_status: partial` with a note explaining what's missing.
- **NEVER guess quantitative values.** Only use numbers you can cite.
- **Features MUST be from the valid vocabulary** defined in `data/config/indicators.yaml`. Do not create new feature names.
- **Always provide sources.** Even for qualitative assessments, cite where the information comes from.
- **URL is mandatory for every source.** `url: null` is never acceptable except for `type: inferred`. For news articles that are no longer live, find the archived version at `https://web.archive.org/web/<timestamp>/<original-url>`. If truly no URL can be found, change the type to `inferred` and note the original citation.
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
      formula: null                  # null for qualitative/ordinal indicators with no formula
      source:
        citation: null
        url: null
        access_date: null
      reliability: null
      components: {}                 # empty for qualitative indicators
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
2. Run `/scaffold-country <country_id>` (faster than running scaffold.py directly)
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

## Handling Unknowable Years

If a year is genuinely unknowable (e.g., active conflict zone, information blackout, pre-dataset coverage):
- Set `data_status: missing`
- Set `quantitative.value: null`
- In `qualitative.notes`: explain *why* it's unknowable (e.g., "No reliable data available; conflict destroyed statistical infrastructure")
- Set `qualitative.confidence: null`
- Do NOT set `data_status: partial` unless you have at least some data

## Collecting Component Data (Required)

Component data records the underlying inputs for every indicator that has a formula.
Collect components **during the same pass** as the main value — not as a separate enrichment step.
See `source-components` SKILL.md for the complete per-indicator component reference, the shared
variable architecture, and YAML examples.

### Which indicators have components

All quantitative indicators derived via a formula require component collection.
See `source-components` SKILL.md for the complete per-indicator reference. Summary:

**Existing:** `gdp_per_capita`, `inflation`, `unemployment`, `trade_openness`, `fiscal_health`,
`fdi`, `refugee_flows`, `political_violence`

**Population mobility (new):** `net_migration`, `emigration_rate`, `immigration_rate`,
`remittances`, `brain_drain`

**Labor / demographic (new):** `total_population`, `working_age_population`,
`labor_force_participation`, `employment`, `informal_economy`

**Social / human development (new):** `life_expectancy`, `infant_mortality`, `internet_users`,
`mobile_subscriptions`, `health_expenditure`, `education_expenditure`, `gini`, `youth_unemployment`

**Economic (new):** `natural_resource_rents` (5 sub-rents), `military_expenditure`

**Governance (new):** `political_stability`, `government_effectiveness`, `control_of_corruption`
(WGI metadata components)

For guidance on which source to use for each component, read:
`.claude/skills/source-components/SKILL.md`

### When to collect components

- **Second-pass enrichment**: After completing a primary data collection session, return to
  filled indicators and add component values for any year where you can source them.
- **Gap-filling derivation**: If the direct rate/ratio series has a gap for a year, collect
  numerator and denominator separately, compute the rate manually, enter it as
  `quantitative.value`, and store the raw components under `quantitative.components`.
- **Cross-validation**: Collecting components lets you verify the main value is internally
  consistent (e.g., unemployed/labor_force should approximately equal the unemployment rate).

Do not collect components for indicators not listed in `indicators.yaml`'s `components` section.

### YAML schema for components

Components live under `quantitative.components` in the raw YAML file. Each component has:
`value`, `unit`, `source` (same structure as the main source block), and `reliability`.

```yaml
  <year>:
    data_status: complete
    quantitative:
      value: <main_rate_or_ratio>
      unit: <main_unit>
      source:
        citation: "..."
        url: "..."
        access_date: "YYYY-MM-DD"
      reliability: <high|medium|low>
      components:
        <component_name>:
          value: <number>
          unit: <unit_string>
          source:
            citation: "..."
            url: "..."
            access_date: "YYYY-MM-DD"
          reliability: <high|medium|low>
        <component_name_2>:
          value: <number>
          unit: <unit_string>
          source:
            citation: "..."
            url: "..."
            access_date: "YYYY-MM-DD"
          reliability: <high|medium|low>
```

Example for `unemployment` Iraq 2014:

```yaml
  2014:
    data_status: complete
    quantitative:
      value: 16.0
      unit: percent_labor_force
      source:
        citation: "World Bank WDI, SL.UEM.TOTL.ZS, accessed 2026-03-01"
        url: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS"
        access_date: "2026-03-01"
      reliability: medium
      components:
        unemployed_persons:
          value: 1350000
          unit: persons
          source:
            citation: "ILO ILOSTAT, UNE_TUNE_SEX_AGE_NB, Iraq, 2014, accessed 2026-03-01"
            url: "https://ilostat.ilo.org/data/"
            access_date: "2026-03-01"
          reliability: medium
        labor_force:
          value: 8440000
          unit: persons
          source:
            citation: "World Bank WDI, SL.TLF.TOTL.IN, accessed 2026-03-01"
            url: "https://data.worldbank.org/indicator/SL.TLF.TOTL.IN"
            access_date: "2026-03-01"
          reliability: medium
```

### Rules for component collection

- **Never invent component values.** Same rule as main values — only enter numbers you can cite.
- **Components are independent of `data_status`.** Adding components to a year that is already
  `complete` does not change its `data_status`. Do not downgrade a complete year's status when
  adding components.
- **Null is acceptable.** If you can source one component but not the other, enter what you have
  and leave the other as `null`. Include a note in `qualitative.notes` explaining which component
  is missing.
- **Do not add `components` to indicators not in `indicators.yaml`'s `components` section.**

## After Collection

Run these to verify your work:
```bash
python3 data/scripts/validate.py --country <country_id>
python3 data/scripts/generate_scores.py --country <country_id> --verbose --only-scored
python3 data/scripts/plot_data.py --countries <country_id> --show-dimensions --output plots/<country_id>_dimensions.png
# Quick visual sanity check — confirm the data looks reasonable before finishing
```

Or use the dedicated commands:
- `/validate-data --country <country_id>`
- `/generate-scores --country <country_id>`

## Session Learning Prompt

After completing a collection session, if you encountered any edge cases, confusing instructions, or gaps in sourcing guidance, append a note to `.claude/meta/learnings/collect-data.md` (or the relevant `source-*` skill's learnings file) in this format:

```markdown
## YYYY-MM-DD
- <what worked well>
- <what was confusing or missing>
- <edge case encountered and how it was resolved>
```

This feeds the `/improve-skill` meta-skill for continuous improvement.

## Now proceed

Read the user's request and begin collecting data. Work through each indicator systematically, editing each file in turn.

$ARGUMENTS
