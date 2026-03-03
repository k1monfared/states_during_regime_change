---
name: source-wgi
layer: 1-source
purpose: How to source World Governance Indicators (Political Stability, Government Effectiveness, Control of Corruption, and other WGI dimensions)
indicators: [political_stability, government_effectiveness, control_of_corruption, voice_accountability, rule_of_law, regulatory_quality]
used_by: [collect-data]
---

# Source: World Bank World Governance Indicators (WGI)

## What It Measures

The World Governance Indicators (WGI) project measures six dimensions of governance for ~200
countries, 1996–present. Each dimension is a composite of dozens of underlying governance surveys
and expert assessments, standardized onto a common scale.

For this project, three dimensions are directly relevant as new indicators, two partially overlap
with existing indicators, and one is a potential future addition:

| WGI Dimension | Short code | Project indicator | Status |
|--------------|------------|------------------|--------|
| Voice and Accountability | VA | overlaps `civil_liberties` | supplementary |
| Political Stability and Absence of Violence | PV | `political_stability` | **new** |
| Government Effectiveness | GE | `government_effectiveness` | **new** |
| Regulatory Quality | RQ | — | future |
| Rule of Law | RL | overlaps `legal_transparency` | supplementary |
| Control of Corruption | CC | `control_of_corruption` | **new** |

## Access

- **Portal**: https://info.worldbank.org/governance/wgi/
- **Data download**: https://info.worldbank.org/governance/wgi/Home/downLoadFile?fileName=wgidataset.xlsx
  (Excel; contains all 6 dimensions × all countries × all years)
- **Interactive query**: https://databank.worldbank.org/source/worldwide-governance-indicators
- **Coverage**: Annual, 1996–present (with gaps in some early years)
- **Scale**: Estimate runs approximately −2.5 (worst) to +2.5 (best); percentile rank 0–100

## Key Series Codes (World Bank Databank)

Each WGI dimension has five data fields:

| Field | Code suffix | Description |
|-------|-------------|-------------|
| Estimate | `.EST` | The composite score (−2.5 to +2.5) |
| Standard error | `.STD` | Uncertainty around the estimate |
| Number of sources | `.NO.SRC` | How many underlying surveys contributed |
| Percentile rank | `.PER.RNK` | Country's rank among all countries (0=lowest, 100=highest) |
| Percentile rank lower bound (90% CI) | `.PER.RNK.LOWER` | Lower bound |
| Percentile rank upper bound (90% CI) | `.PER.RNK.UPPER` | Upper bound |

Prefix codes:
- Political Stability: `PV`
- Government Effectiveness: `GE`
- Control of Corruption: `CC`
- Voice and Accountability: `VA`
- Rule of Law: `RL`
- Regulatory Quality: `RQ`

Example: `PV.EST` = Political Stability estimate; `GE.PER.RNK` = Government Effectiveness percentile rank.

## Main Value to Store

Use the **estimate** (`.EST`) as `quantitative.value` for the main indicator. This is the
composite governance score on the −2.5 to +2.5 scale.

The **percentile rank** (`.PER.RNK`) is the most interpretable field for comparison across
countries and time — store it as a component.

## Formula and Methodology

WGI estimates are derived through an Unobserved Components Model (UCM):

```
estimate = UCM_weighted_average(
  normalized_scores from N underlying surveys
  weighted by their signal-to-noise ratio
)
```

The underlying surveys include: Freedom House, Economist Intelligence Unit, World Economic Forum,
ICRG, Bertelsmann Transformation Index, and ~30 others (varies by dimension and year).

The exact input scores and weights are **not publicly available**; only the composite estimate,
standard error, and source count are released. Record the metadata components as the
auditable proxy for the underlying methodology.

## Reliability

- WGI estimates: **medium-high** for stable democracies; **medium** for conflict/authoritarian states
- Standard error is larger where fewer surveys cover the country
- **Important caveat**: WGI captures governance perceptions and expert assessments, not direct
  outcomes. A repressive but functional state (e.g., early Putin-era Russia) may score higher
  on Government Effectiveness than a chaotic but nominally democratic state (e.g., Libya 2012).
- Year-to-year changes can reflect real changes OR changes in survey composition (new surveys
  added/dropped). Check `number_of_sources` year-over-year; large changes there signal
  methodology change, not necessarily real governance change.

## Coverage Gaps

- **Pre-1996**: No WGI data. Use V-Dem or Freedom House for earlier years.
- **2001–2002 gap**: Some dimensions have no data for these years; check before using.
- **Very small states / territories**: May have high standard errors due to limited survey coverage.
- **Active conflict zones**: Expert surveys may be unavailable; some dimensions show `null`
  for years of total state collapse (Somalia, Afghanistan during certain periods).

## Feature Vocabulary

### political_stability (PV.EST, scale −2.5 to +2.5)
| Estimate range | Feature tag |
|---------------|-------------|
| > +1.0 | `very_stable` |
| +0.0 to +1.0 | `stable` |
| −0.5 to +0.0 | `mild_instability` |
| −1.0 to −0.5 | `significant_instability` |
| −1.5 to −1.0 | `high_instability` |
| < −1.5 | `extreme_instability_conflict` |

### government_effectiveness (GE.EST, scale −2.5 to +2.5)
| Estimate range | Feature tag |
|---------------|-------------|
| > +1.0 | `highly_effective` |
| +0.0 to +1.0 | `effective` |
| −0.5 to +0.0 | `partially_effective` |
| −1.0 to −0.5 | `low_effectiveness` |
| < −1.0 | `ineffective_or_captured` |

### control_of_corruption (CC.EST, scale −2.5 to +2.5)
| Estimate range | Feature tag |
|---------------|-------------|
| > +1.0 | `low_corruption` |
| +0.0 to +1.0 | `moderate_corruption` |
| −0.5 to +0.0 | `elevated_corruption` |
| −1.0 to −0.5 | `high_corruption` |
| < −1.0 | `pervasive_corruption` |

## Citation Format

```yaml
citation: "World Bank WGI, <dimension>.EST, <country>, <year>, accessed <date>"
url: "https://info.worldbank.org/governance/wgi/"
access_date: "<YYYY-MM-DD>"
type: composite_index
reliability: medium
```

Example:
```yaml
citation: "World Bank WGI, PV.EST, Iraq, 2005, accessed 2026-03-02"
url: "https://info.worldbank.org/governance/wgi/"
access_date: "2026-03-02"
```

## YAML Components Schema

For WGI indicators, components are **metadata** (not formula inputs), but they make the estimate
auditable and enable uncertainty-aware interpretation:

```yaml
  2005:
    data_status: complete
    quantitative:
      value: -2.24           # PV.EST (composite estimate)
      unit: wgi_estimate_neg25_to_pos25
      formula: "UCM weighted average of N governance surveys; see PV.NO.SRC for N"
      source:
        citation: "World Bank WGI, PV.EST, Iraq, 2005, accessed 2026-03-02"
        url: "https://info.worldbank.org/governance/wgi/"
        access_date: "2026-03-02"
      reliability: medium
      components:
        standard_error:
          value: 0.18
          unit: wgi_std_error
          role: uncertainty
          source:
            citation: "World Bank WGI, PV.STD, Iraq, 2005, accessed 2026-03-02"
            url: "https://info.worldbank.org/governance/wgi/"
            access_date: "2026-03-02"
          reliability: high
        percentile_rank:
          value: 2.4         # PV.PER.RNK — 2.4th percentile = bottom 2-3% globally
          unit: percentile_0_to_100
          role: cross_country_context
          source:
            citation: "World Bank WGI, PV.PER.RNK, Iraq, 2005, accessed 2026-03-02"
            url: "https://info.worldbank.org/governance/wgi/"
            access_date: "2026-03-02"
          reliability: high
        number_of_sources:
          value: 8
          unit: count_of_surveys
          role: methodology_metadata
          source:
            citation: "World Bank WGI, PV.NO.SRC, Iraq, 2005, accessed 2026-03-02"
            url: "https://info.worldbank.org/governance/wgi/"
            access_date: "2026-03-02"
          reliability: high
        percentile_rank_lower_ci:
          value: 0.5
          unit: percentile_0_to_100
          role: confidence_bound
          source:
            citation: "World Bank WGI, PV.PER.RNK.LOWER, Iraq, 2005, accessed 2026-03-02"
            url: "https://info.worldbank.org/governance/wgi/"
            access_date: "2026-03-02"
          reliability: high
        percentile_rank_upper_ci:
          value: 5.3
          unit: percentile_0_to_100
          role: confidence_bound
          source:
            citation: "World Bank WGI, PV.PER.RNK.UPPER, Iraq, 2005, accessed 2026-03-02"
            url: "https://info.worldbank.org/governance/wgi/"
            access_date: "2026-03-02"
          reliability: high
```

## Quick Lookup Steps

1. Go to https://info.worldbank.org/governance/wgi/
2. Click "Interactive → Country Data" or download the full Excel file
3. Select the dimension (PV, GE, CC) and country
4. Read: Estimate, Std Dev, No. of Sources, Percentile Rank, Lower/Upper CI
5. Enter Estimate as `quantitative.value`; enter all five fields as components
6. Note: if `No. of Sources` is <4, flag as low reliability

$ARGUMENTS
