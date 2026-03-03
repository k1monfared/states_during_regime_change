---
name: source-freedomhouse
layer: 1-source
purpose: How to source Freedom House data for civil_liberties and institutional_functioning
indicators: [civil_liberties, institutional_functioning]
used_by: [collect-data]
---

# Source: Freedom House — Freedom in the World

## What It Measures

Freedom House publishes annual Freedom in the World (FitW) reports assessing political rights and civil liberties for every country. The Civil Liberties (CL) score is the primary quantitative source for `civil_liberties`; the Political Rights (PR) score supplements `institutional_functioning`.

## Access

- **Portal**: https://freedomhouse.org/report/freedom-world
- **Data download**: https://freedomhouse.org/report/freedom-world (Excel download available; use "Country and Territory Ratings and Statuses" file)
- **Individual country pages**: https://freedomhouse.org/country/<country-name>/freedom-world/<year>
- **Coverage**: All 39 project countries; historical data back to 1972 (CL/PR) or 1973

## Scale and Inversion

Freedom House uses a **1–7 scale where 1 = most free, 7 = least free**.

This project uses a **0–100 scale where 100 = most free**.

> **Year Assignment Warning**: Freedom House "Freedom in the World YYYY" reports cover *calendar year YYYY-1*. Always subtract 1 from the report year to get the data year. Example: "Freedom in the World 2022" → enter as year 2021.

**Conversion formula**:
```
project_score = (8 - FH_CL) / 7 * 100
```

| FH CL | Project Score |
|-------|---------------|
| 1 | 100 |
| 2 | 85.7 |
| 3 | 71.4 |
| 4 | 57.1 |
| 5 | 42.9 |
| 6 | 28.6 |
| 7 | 14.3 |

Note: This conversion is applied by `generate_scores.py` internally — enter the **raw FH score (1–7)** in `quantitative.value`, not the converted score.

## Key Series

| Indicator | FH Field | Notes |
|-----------|----------|-------|
| `civil_liberties` | CL (Civil Liberties) | Primary; 1–7 integer |
| `institutional_functioning` | PR (Political Rights) | Supplementary; 1–7 integer |
| Status | Free / Partly Free / Not Free | Note in `qualitative.assessment` |

## Aggregate Score (2013+ methodology change)

From 2013 onwards, Freedom House also publishes an aggregate 0–100 score in addition to the 1–7 CL/PR scores. For this project:
- Use the 1–7 CL/PR integer scores for `quantitative.value` (for consistency across all years)
- The 0–100 aggregate score can be noted in `qualitative.notes`

## Historical Coverage

| Period | Notes |
|--------|-------|
| 1972–present | CL and PR scores available for most countries |
| Pre-1995 | Some countries not yet rated; use `data_status: missing` if absent |
| 2005–present | Subcategory scores available (additional detail) |

## Citation Format

```yaml
citation: "Freedom House, Freedom in the World <year>, Civil Liberties Score for <country>"
url: "https://freedomhouse.org/country/<country>/freedom-world/<year>"
access_date: "<YYYY-MM-DD>"
type: ngo_report
reliability: medium
```

> **URL is mandatory.** Use the country-year permalink: `https://freedomhouse.org/country/<country>/freedom-world/<year>`. Never leave `url: null`.

## Reliability Notes

- FH scores are based on expert coding with editorial oversight; widely cited but subjective
- Reliability: **medium** — consistent methodology but based on analyst judgment
- Known bias concern: Some critics argue FH scores reflect US foreign policy interests; for robustness, cross-check with V-Dem (see `source-vdem`) for politically sensitive cases
- Year assignment: FH reports published in early year N cover the previous calendar year N-1 (e.g., "Freedom in the World 2022" covers 2021). Confirm this when citing.

## When FH Data Is Absent

FH rates all 39 project countries. If a specific year is missing:
- Check for the adjacent year
- Use V-Dem as fallback (see `source-vdem`)
- Note any coverage gap in `notes`

## Quick Lookup Steps

1. For multi-year collection (>3 years): download the Excel file "Country and Territory Ratings and Statuses" from https://freedomhouse.org/report/freedom-world — far faster than year-by-year portal access
2. For single years: go to https://freedomhouse.org/country/<country>/freedom-world/<report-year>
3. Report year = data year + 1; look up report YYYY+1 to get data for year YYYY
4. Read the CL score (1–7 integer) — enter the **raw CL score** in `quantitative.value`, NOT the 0-100 aggregate
5. Note the status (Free/Partly Free/Not Free) in `qualitative.assessment`

$ARGUMENTS
