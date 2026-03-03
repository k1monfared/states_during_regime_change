---
name: source-conflict
layer: 1-source
purpose: How to source UCDP/ACLED data for political_violence and territorial_control
indicators: [political_violence, territorial_control]
used_by: [collect-data]
---

# Source: Conflict Data (UCDP & ACLED)

## What It Measures

Conflict datasets quantify armed violence events, casualties, and geographic scope of conflict. Used to support both quantitative and qualitative filling of `political_violence` and `territorial_control`.

## Two Primary Sources

### 1. UCDP — Uppsala Conflict Data Program

- **Portal**: https://ucdp.uu.se
- **Dataset**: UCDP Georeferenced Event Dataset (GED) — individual conflict events with coordinates, dates, actor IDs, and death estimates
- **Coverage**: 1989–present; updated annually; reliable for full-country conflict patterns
- **Download**: https://ucdp.uu.se/downloads (GED global dataset, CSV or Parquet)
- **Conflict types**: state-based (government vs. rebel), non-state (group vs. group), one-sided (targeting civilians)

### 2. ACLED — Armed Conflict Location & Event Data

- **Portal**: https://acleddata.com
- **Coverage**: 1997–present for Africa/Asia; 2016–present for others; real-time updates
- **Data**: Battles, violence against civilians, protests, riots, strategic developments — geo-coded
- **Download**: https://acleddata.com/data-export-tool (free registration required)
- **Strength**: More granular than UCDP; captures political violence below war threshold (protests, riots)

## Which to Use When

| Scenario | Use |
|----------|-----|
| Annual battle death counts (war-level) | UCDP GED |
| Sub-national geographic spread | ACLED |
| Violence below armed conflict threshold | ACLED |
| Historical data pre-1997 | UCDP only |
| Real-time or recent-year data | ACLED |
| Cross-checking estimates | Both |

## Crosswalk: Raw Death Counts → Feature Vocabulary

The project's feature vocabulary for `political_violence` is defined in `data/config/indicators.yaml`. Approximate mappings:

| Annual battle deaths (UCDP) | Feature tag |
|-----------------------------|-------------|
| 0 | `no_political_violence` |
| 1–25 | `sporadic_low_level_violence` |
| 26–100 | `minimal_lt_100` |
| 101–1,000 | `moderate_100_1000` |
| 1,001–10,000 | `high_1000_10000` |
| >10,000 | `severe_gt_10000` |
| Primarily civilian targeting | `mass_atrocities` or `genocide_crimes_against_humanity` |
| Suicide bombings, IEDs | `insurgency_terrorism` |

Always cross-check with qualitative context — death counts alone don't capture the nature of violence.

## Crosswalk: Territorial Control Features

For `territorial_control`, UCDP/ACLED geographic data helps assess:
- **Number of active groups controlling territory** → `fragmented_control_multiple_actors`
- **Government presence in capital but not periphery** → `large_portions_contested_30_50pct`
- **Foreign forces present** → `foreign_occupation`
- **Remote areas with no state presence** → `ungoverned_spaces`

## Citation Format

```yaml
# UCDP GED:
citation: "UCDP Georeferenced Event Dataset (GED), version 23.1, <country>, <year range>"
url: "https://ucdp.uu.se/downloads"
access_date: "<YYYY-MM-DD>"
type: index_dataset
reliability: high

# ACLED:
citation: "ACLED Data for <country>, <year>, accessed <YYYY-MM-DD>"
url: "https://acleddata.com/data-export-tool/"
access_date: "<YYYY-MM-DD>"
type: index_dataset
reliability: high
```

> **URL is mandatory.** Use `https://ucdp.uu.se/downloads` for UCDP and `https://acleddata.com/data-export-tool/` for ACLED. Never leave `url: null`.

## Reliability Notes

- UCDP uses conservative death estimates (minimum plausible) — actual deaths may be higher
- ACLED counts events (including non-lethal) rather than deaths only — not directly comparable to UCDP
- Both sources undercount in areas with restricted media access (North Korea, parts of Syria/Yemen)
- For years before 1989 (pre-UCDP coverage), use qualitative assessment with `confidence: low`

## When Conflict Data Is Absent

If neither UCDP nor ACLED has data for a specific country-year:
- Set `quantitative.value: null`
- Use qualitative assessment from news/ICG reports
- Set `confidence: low` and note the data gap
- Consider using the `source-qualitative` skill for the full entry

For years before 1989 (pre-UCDP coverage), always use the `source-qualitative` skill for the full entry. Some ACLED data exists pre-1997 for Africa but treat as supplementary only.

## Quick Lookup Steps

### UCDP GED:
1. Go to https://ucdp.uu.se → select country → select year range
2. Read total battle deaths for the year
3. Apply the crosswalk table above to select the feature tag
4. If near a threshold boundary (±10%), use the lower category and note both figures in `qualitative.notes`

### ACLED:
1. Go to https://acleddata.com/data-export-tool → filter by country + year
2. Sum fatalities across all event types
3. Compare to UCDP figure; if divergence >50%, note both: "UCDP: X, ACLED: Y"
4. Prefer UCDP as the primary `quantitative.value`

$ARGUMENTS
