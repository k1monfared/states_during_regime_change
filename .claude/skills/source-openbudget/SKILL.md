---
name: source-openbudget
layer: 1-source
purpose: How to source Open Budget Survey for budget_transparency
indicators: [budget_transparency]
used_by: [collect-data]
---

# Source: Open Budget Survey (OBS)

## What It Measures

The International Budget Partnership (IBP) publishes the Open Budget Survey biennially, scoring countries on budget transparency (0–100), public participation, and oversight. The Open Budget Index (OBI) score is the quantitative source for `budget_transparency`.

## Access

- **Portal**: https://internationalbudget.org/open-budget-survey
- **Data**: https://internationalbudget.org/open-budget-survey/results-by-country (country pages with historical scores)
- **Download**: Full dataset available as Excel/CSV from the IBP results page
- **Coverage**: Biennial (every 2 years); started 2006; not all project countries included

## Scale

OBI score: **0–100, higher = more transparent**. This already matches the project scale. Enter the raw OBI score in `quantitative.value` with no conversion needed.

## Survey Years

| Year | Notes |
|------|-------|
| 2006 | First edition; limited coverage |
| 2008 | Expanded country coverage |
| 2010 | Standard biennial cycle |
| 2012, 2015, 2017, 2019, 2021, 2023 | Continued biennial (with some irregular timing) |

The survey covers the prior fiscal year's budget practices.

## Interpolating Between Biennial Years

For years without a survey (odd years), interpolate linearly:
```
score_t = score_{t-1} + (score_{t+1} - score_{t-1}) / 2
```

In the YAML entry, set:
```yaml
data_status: partial
quantitative:
  value: 42   # linear interpolation between survey years
  unit: score_0_100
  source:
    citation: "Interpolated between IBP Open Budget Survey <year1> (score=X) and OBS <year2> (score=Y)"
    url: null
    access_date: null
  reliability: medium
qualitative:
  assessment: |
    Budget transparency score interpolated between OBS <year1> and OBS <year2>.
    No survey conducted in this year.
  features:
    - <appropriate feature tag>
  sources: []
  confidence: medium
  notes: "Interpolated value — OBS is biennial; no direct survey this year"
```

## Coverage Gaps

Not all 39 project countries are included in every survey. Common gaps:
- **Yemen, Syria, Libya (post-2011)**: Surveys suspended due to conflict
- **Myanmar**: Gaps post-2021 coup; IBP suspended participation
- **Early years (2006–2010)**: Limited to ~85 countries; some project countries absent

When a country is not in a survey year, set `data_status: missing` and note the absence.

## Citation Format

```yaml
citation: "IBP Open Budget Survey <year>, Open Budget Index score for <country>"
url: "https://internationalbudget.org/open-budget-survey"
access_date: "<YYYY-MM-DD>"
type: ngo_report
reliability: medium
```

## Reliability Notes

- OBI scores: **medium** — based on independent researcher questionnaires reviewed by IBP; credible but subjective
- The score reflects de jure transparency (documents published) more than de facto access; note this if relevant
- Biennial surveys create gaps in annual time series

## Qualitative Fallback

When OBS data is absent:
1. Check IBP country page for qualitative assessments
2. Use World Bank PEFA assessments (Public Expenditure and Financial Accountability) as supplementary
3. Document with `confidence: low`
4. Describe qualitatively: budget law passed, budget publicly available, mid-year review published, etc.

$ARGUMENTS
