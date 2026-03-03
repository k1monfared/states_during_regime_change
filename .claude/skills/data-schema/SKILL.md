---
name: data-schema
layer: 1-general
purpose: Canonical reference for the raw YAML data structure used in every indicator file
used_by: [collect-data, validate-data, source-worldbank, source-imf, source-conflict, source-freedomhouse, source-rsf, source-openbudget, source-wjp, source-eiti, source-unhcr, source-vdem, source-qualitative]
---

# Data Schema — Raw YAML Structure

This skill describes the exact schema every indicator YAML file must follow.
Any skill or command that reads or writes raw data files should consult this reference.

## File Path Pattern

```
data/raw/<country_id>/<dimension>/<indicator>.yaml
```

**Dimensions**: `political`, `economic`, `international`, `transparency`

**Indicators by dimension**:
- political: `territorial_control`, `political_violence`, `institutional_functioning`, `civil_liberties`, `elite_cohesion`
- economic: `gdp_per_capita`, `inflation`, `unemployment`, `trade_openness`, `fiscal_health`
- international: `sanctions`, `diplomatic_integration`, `foreign_military`, `fdi`, `refugee_flows`
- transparency: `budget_transparency`, `press_freedom`, `statistical_transparency`, `legal_transparency`, `extractive_transparency`

## Top-Level File Structure

```yaml
country: <country_id>           # matches key in data/config/countries.yaml
indicator: <indicator_name>     # matches key in data/config/indicators.yaml
dimension: <dimension_name>
unit: <unit_string>             # from indicators.yaml
years:
  <YYYY>:
    <year entry — see below>
  <YYYY>:
    ...
```

## Year Entry Schema

```yaml
  <YYYY>:
    data_status: <status>         # see Data Status Values below
    quantitative:
      value: <number | null>
      unit: <unit_string>         # repeat from top level for clarity
      source:
        citation: <string | null> # full citation e.g. "World Bank WDI, 2024"
        url: <url | null>
        access_date: <YYYY-MM-DD | null>
      reliability: <reliability>  # see Reliability Values below
    qualitative:
      assessment: |
        <2–4 sentence narrative describing the situation in this year>
      features:
        - <feature_tag>           # MUST be from valid_features in indicators.yaml
        - <feature_tag>
      sources:
        - citation: <string>
          url: <url | null>
          type: <source_type>     # see Source Types below
          reliability: <reliability>
      confidence: <confidence>    # see Confidence Values below
      notes: <string | null>      # caveats, data gaps, context
```

## Schema v2 — quantitative block extensions (adopted 2026-03-02)

Three new fields under `quantitative:`:

```yaml
  <YYYY>:
    data_status: complete
    quantitative:
      value: 614.32             # primary value used for scoring
      value_source: downloaded  # "downloaded" | "calculated" — how value was obtained
      series_id: WB_NY.GDP.PCAP.CD   # canonical series reference (format: SOURCE_CODE)
      calculated_value: 614.18  # from compute_derived.py; null if not computable
      discrepancy:              # present only when both downloaded and calculated exist
        downloaded: 614.32
        calculated: 614.18
        diff: 0.14
        note: "Rounding difference; both agree within 0.1%"
      unit: USD_current
      formula: "(gdp_current_usd / population)"
      ...
```

### value_source rules

| Scenario | value_source | value | calculated_value |
|----------|-------------|-------|-----------------|
| Downloaded from API | `downloaded` | from API | null (or computed) |
| Computed from formula, no download | `calculated` | from formula | same as value |
| Both exist, downloaded wins | `downloaded` | from API | from formula |
| Manual entry (qualitative indicator) | omit | from human research | null |

### series_id format

`<SOURCE>_<CODE>` — e.g. `WB_NY.GDP.PCAP.CD`, `ILO_UNE_TUNE_SEX_AGE_NB`, `WGI_CC`

Leave null for qualitative indicators or indicators without a canonical series.

### When compute_derived.py runs

`compute_derived.py` reads canonical CSVs → writes `calculated_value` into YAML files.
If `value` is null (never filled manually or downloaded), it also sets `value` and `value_source: calculated`.
Does NOT overwrite an existing downloaded `value`.

## Data Status Values

| Value | Meaning |
|-------|---------|
| `complete` | Both quantitative and qualitative sections fully filled; no critical gaps |
| `partial` | Some data present but gaps exist (missing quant value, missing years, incomplete features) |
| `missing` | No data found; entry is placeholder only |
| `not_applicable` | Indicator does not apply to this country-year (e.g., `extractive_transparency` for a country with no EITI relevance) |

## Reliability Values

| Value | Meaning |
|-------|---------|
| `high` | Official statistics, peer-reviewed source, established international organization (IMF, World Bank, UN) |
| `medium` | Credible estimates, single reliable NGO source, think tank report |
| `low` | Inferred, secondary reporting, rough approximation |

## Confidence Values

| Value | Meaning |
|-------|---------|
| `high` | Multiple corroborating sources agree; no significant contradictory evidence |
| `medium` | Single reliable source; or multiple sources with minor discrepancies |
| `low` | Inferred from indirect evidence; single weak source; significant uncertainty |

## Source Types

| Type | Examples |
|------|---------|
| `official_statistics` | World Bank WDI, IMF WEO, national statistical office |
| `international_organization` | UN, UNHCR, WHO, OCHA |
| `think_tank_report` | ICG, Chatham House, Carnegie, Brookings, SIPRI |
| `academic_paper` | Peer-reviewed journal article |
| `news_report` | Newspaper, wire service (Reuters, AP, BBC) |
| `government_document` | Official government report, law, decree |
| `ngo_report` | Freedom House, RSF, Amnesty International, Human Rights Watch |
| `index_dataset` | V-Dem, Polity, BTI, WJP Rule of Law Index |
| `inferred` | Analyst judgment without direct citation |

## Feature Vocabulary Pattern

Features are controlled-vocabulary tags from `data/config/indicators.yaml`.
**Never create new feature names.** Always pick from the `valid_features` list for the specific indicator.

Example for `territorial_control`:
```yaml
features:
  - full_government_control
  # OR: large_portions_contested_30_50pct
  # OR: majority_territory_contested_50_70pct
  # OR: fragmented_control_multiple_actors
  # OR: foreign_occupation
  # OR: ungoverned_spaces
```

To find valid features for an indicator, read `data/config/indicators.yaml` and look for `valid_features` under the indicator name.

## Source Citation Format

Cite sources in the format: `"Author/Organization, Title, Year"` or for databases: `"World Bank WDI, Series NY.GDP.PCAP.CD, accessed 2024-01-15"`.

For URLs: include the direct link if possible; use the data landing page if direct links expire.

## URL Requirement — MANDATORY

**Every source entry MUST include a `url`.** Full traceability is a core requirement of this project.

| Source type | URL guidance |
|-------------|-------------|
| `official_statistics` | Direct indicator page (e.g. `https://data.worldbank.org/indicator/NY.GDP.PCAP.CD`) |
| `international_organization` | Report or dataset page (e.g. `https://www.unhcr.org/refugee-statistics/`) |
| `think_tank_report` | Report permalink on issuing organization's website |
| `academic_paper` | DOI URL (e.g. `https://doi.org/10.1016/...`) or journal permalink |
| `news_report` | Original article URL; if unavailable use Wayback Machine archived version (`https://web.archive.org/web/<timestamp>/<url>`) or Google News (`https://news.google.com/`) |
| `government_document` | Official government or legislative portal link |
| `ngo_report` | Report page on issuing organization's website |
| `index_dataset` | Dataset download or documentation page |
| `inferred` | `url: null` is acceptable **only** for `inferred` type — no other type may use null |

**Never leave `url: null`** for any source except `type: inferred`. If a URL is temporarily unavailable, search for an archived copy at `https://web.archive.org/`. If no URL can be found at all, change the source type to `inferred` and note the original citation in the `citation` field.

## Null vs. Empty String

- Use `null` for unknown/missing values (not `""` or `"N/A"`)
- Leave `features: []` only when the qualitative section is genuinely unfilled
- When a year has no data at all, set `data_status: missing` and leave all fields null

## Worked Example

```yaml
country: iraq
indicator: gdp_per_capita
dimension: economic
unit: USD_current
years:
  2003:
    data_status: complete
    quantitative:
      value: 614
      unit: USD_current
      source:
        citation: "World Bank WDI, NY.GDP.PCAP.CD, accessed 2024-02-01"
        url: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD"
        access_date: "2024-02-01"
      reliability: high
    qualitative:
      assessment: |
        Iraq's GDP per capita collapsed following the 2003 invasion due to
        destruction of infrastructure, disruption of oil exports, and
        widespread looting. Recovery began slowly in late 2003.
      features:
        - severe_economic_contraction
        - post_conflict_reconstruction
      sources:
        - citation: "World Bank WDI, NY.GDP.PCAP.CD, accessed 2024-02-01"
          url: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD"
          type: official_statistics
          reliability: high
      confidence: high
      notes: "2003 figure reflects partial-year post-invasion economy"
```
