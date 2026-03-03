---
name: source-oecd-migration
layer: 1-source
purpose: How to source brain_drain and skilled emigration data for the population_mobility dimension
indicators: [brain_drain]
used_by: [collect-data]
---

# Source: OECD DIOC and WEF Brain Drain Data

## What It Measures

Brain drain captures the **emigration of highly-skilled or educated workers** — a long-term
signal of institutional and economic damage that often precedes or follows regime change.
Countries with severe brain drain lose the human capital needed to rebuild.

For this project, `brain_drain` measures the share of tertiary-educated nationals living abroad
relative to the total stock of tertiary-educated persons from that country.

## Access

### OECD DIOC (Database on Immigrants in OECD Countries)
- **Portal**: https://www.oecd.org/en/topics/sub-issues/migration-data/dioc.html
- **Direct data**: https://stats.oecd.org → search "DIOC"
- **Coverage**: Rounds: 2000/01, 2005/06, 2010/11, 2015/16 — bi-annual snapshots only
- **Series**: Emigrant counts by education level (low/medium/high) by country of origin
- **Key table**: "Emigrants by level of education and country of origin"
- **Limitation**: Only covers OECD destinations — misses Gulf states, Russia, South-South migration

### World Bank — Skilled Emigration
- **Series**: `SM.EMI.TERT.ZS` — Emigration rate of tertiary-educated people (% of total tertiary-educated)
- **Portal**: https://data.worldbank.org/indicator/SM.EMI.TERT.ZS
- **Coverage**: Available for ~2000, 2010; sparse; derived from OECD DIOC + non-OECD destinations
- **Note**: This is the preferred primary series for `brain_drain` as it normalizes by education stock

### WEF Global Competitiveness Report — Brain Drain Survey
- **Portal**: https://www.weforum.org/reports/the-global-competitiveness-report
- **Series**: "Brain drain" (or "Talent retention") — executives' perception survey (1–7 scale)
- **Coverage**: Annual, 2000s–present; ~140 countries
- **Use for**: Annual qualitative complement to quinquennial OECD/WB data
- **Note**: Perception-based, not headcount — useful for trend direction in years between OECD rounds

### OECD.Stat — Education at a Glance
- **Portal**: https://www.oecd-ilibrary.org/education/education-at-a-glance
- **Use for**: Destination country context (how many students/workers from country X are in OECD countries)

## Key Metric: Brain Drain Rate

```
brain_drain_rate = (tertiary_educated_emigrants / total_tertiary_educated_nationals) × 100
```

Where total tertiary-educated nationals = those at home + those abroad.

**Primary series**: World Bank `SM.EMI.TERT.ZS` gives this directly.
**Fallback**: Compute from OECD DIOC (high-education emigrants) + UNESCO domestic tertiary enrollment stocks.

## Reliability

- World Bank SM.EMI.TERT.ZS: **medium** — derived from OECD DIOC + corrections; undercounts non-OECD destinations
- OECD DIOC high-education: **medium-high** for OECD destinations; incomplete for non-OECD
- WEF brain drain survey: **low** (perception-based); use only as direction indicator
- For conflict states (Syria, Yemen, etc.): **low** — skilled diaspora is large but poorly measured; note as estimate

## Coverage Gaps

- **Non-OECD destinations**: Iranian professionals in UAE, Iraqi professionals in Jordan/Lebanon —
  not captured by OECD DIOC. For Middle East countries, rates may be significantly underestimated.
  Note this limitation explicitly.
- **Pre-2000**: No reliable global data. Use country-specific academic sources if available.
- **Annual resolution**: OECD DIOC is quinquennial; WB series has only 2 data points.
  For intermediate years, interpolate linearly between data points and note in `qualitative.notes`.
- **Returnees not counted**: Brain drain rate doesn't capture returnees (diaspora return). Context
  from IOM or country-specific sources needed.

## Feature Vocabulary (population_mobility dimension)

### brain_drain (% tertiary-educated nationals abroad)
| Rate | Feature tag |
|------|-------------|
| <5% | `minimal_brain_drain` |
| 5–15% | `moderate_brain_drain` |
| 15–30% | `significant_brain_drain` |
| 30–50% | `severe_brain_drain` |
| >50% | `critical_brain_drain` |
| Accelerating + conflict context | `acute_brain_drain_crisis` |

## Citation Format

```yaml
# World Bank:
citation: "World Bank WDI, SM.EMI.TERT.ZS, <country>, <year>, accessed <date>"
url: "https://data.worldbank.org/indicator/SM.EMI.TERT.ZS"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: medium

# OECD DIOC:
citation: "OECD DIOC <round>, emigrants with tertiary education from <country>"
url: "https://www.oecd.org/en/topics/sub-issues/migration-data/dioc.html"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: medium

# WEF:
citation: "WEF Global Competitiveness Report <year>, Brain Drain indicator, <country>"
url: "https://www.weforum.org/reports/the-global-competitiveness-report"
access_date: "<YYYY-MM-DD>"
type: survey_index
reliability: low
```

## Quick Lookup Steps

### Primary (World Bank SM.EMI.TERT.ZS):
1. Go to https://data.worldbank.org/indicator/SM.EMI.TERT.ZS
2. Filter by country → read available years (typically ~2000, ~2010)
3. Enter as percentage directly — already normalized

### Fallback (OECD DIOC):
1. Go to https://stats.oecd.org → search "DIOC"
2. Select "Emigrants by education level" table
3. Filter by country of origin → high education column → sum across destination countries
4. Find domestic tertiary stock from UNESCO UIS (http://uis.unesco.org)
5. Compute: (OECD_high_edu_emigrants / (domestic_tertiary + OECD_high_edu_emigrants)) × 100

### Annual estimates for non-data-point years:
1. Get the two bracketing OECD/WB data points
2. Interpolate linearly
3. Cross-check direction against WEF annual survey
4. Note interpolation in `qualitative.notes`

$ARGUMENTS
