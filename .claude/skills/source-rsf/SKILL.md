---
name: source-rsf
layer: 1-source
purpose: How to source RSF World Press Freedom Index for press_freedom
indicators: [press_freedom]
used_by: [collect-data]
---

# Source: RSF — World Press Freedom Index

## What It Measures

Reporters Without Borders (RSF) publishes an annual World Press Freedom Index ranking countries on press freedom conditions, including legal framework, political context, economic context, sociocultural context, and safety of journalists.

## Access

- **Portal**: https://rsf.org/en/index
- **Data download**: https://rsf.org/en/index (CSV download available on the index page)
- **Individual countries**: https://rsf.org/en/<country-name>
- **Coverage**: Published annually since 2002; 180 countries

## Scale and Inversion

RSF uses a **0–100 scale where higher = more press freedom** (since 2022 methodology).

Before 2022 (legacy 0–100 scale): **lower = worse**, same as current.

**Conversion for this project** (since both scales: 100 = best, 0 = worst):
```
project_score = RSF_Score   # Direct entry — no conversion needed
# RSF scale (all editions): 100 = most free, 0 = least free — already matches the project scale
# Enter the raw RSF score directly in quantitative.value. No inversion required.
```

## Methodology Changes

| Period | Methodology | Comparability |
|--------|------------|---------------|
| 2002–2012 | Questionnaire-based; ranking only for early years | Limited quantitative comparison across this break |
| 2013–2021 | Revised composite methodology; 0–100 score | Broadly comparable within this window |
| 2022–present | New methodology; restructured pillars | Scores not directly comparable to pre-2022 |

When comparing across methodology breaks, note in `qualitative.notes`:
```
notes: "Pre-2022 RSF scores use legacy methodology; not directly comparable to 2022+ scores"
```

## Fallback for Historical Gaps

RSF coverage begins 2002. For earlier years:
- **Freedom House Press Freedom** (discontinued 2017): Scale 0–100; 100 = free. Available in archived FH data for media freedom specifically.
- For pre-2002: qualitative assessment only; use `source-qualitative` skill; set `confidence: low`

## Citation Format

```yaml
citation: "RSF World Press Freedom Index <year>, score for <country>"
url: "https://rsf.org/en/index"
access_date: "<YYYY-MM-DD>"
type: ngo_report
reliability: medium
```

## Reliability Notes

- RSF scores: **medium** — based on expert questionnaires; widely used but reflects journalist networks' access and priorities
- Coverage gaps: RSF rates most 39 project countries; check if a specific country was absent from a given year's index
- North Korea, Eritrea, Turkmenistan consistently bottom-ranked — if the project ever adds these, note the floor effects
- For conflict countries (Syria, Yemen, Libya post-2011): RSF scores reflect increasingly dangerous conditions; treat as **high** confidence for those conditions

## When RSF Data Is Absent

If RSF hasn't covered a country-year:
1. Try Freedom House Press Freedom (archived, pre-2017)
2. Use qualitative assessment with `source-qualitative` skill
3. Set `data_status: partial` and `confidence: low`
4. Document the gap clearly in `notes`

## Quick Lookup Steps

1. For multi-year collection: download the CSV from https://rsf.org/en/index (all countries, all years since 2002 in one file)
2. For single years: go to https://rsf.org/en/<country-name> → find the year
3. Enter the score (0–100) directly in `quantitative.value`
4. Check the methodology period: pre-2013, 2013–2021, or 2022+ (see Methodology Changes table)
5. For entries spanning a methodology break, add to `qualitative.notes`: "Pre-2022 RSF scores use legacy methodology; not directly comparable to 2022+ scores"

$ARGUMENTS
