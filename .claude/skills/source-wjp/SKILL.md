---
name: source-wjp
layer: 1-source
purpose: How to source WJP Rule of Law Index for legal_transparency
indicators: [legal_transparency]
used_by: [collect-data]
---

# Source: WJP Rule of Law Index

## What It Measures

The World Justice Project (WJP) Rule of Law Index measures adherence to the rule of law across 8 factors in ~140 countries. For this project, **Factor 3: Open Government** directly measures legal and government transparency.

## Access

- **Portal**: https://worldjusticeproject.org/rule-of-law-index
- **Data download**: https://worldjusticeproject.org/rule-of-law-index/downloads (Excel with all years and countries)
- **Coverage**: Starts 2008 (first edition); annual since 2014; some gap years 2010–2013
- **Current coverage**: ~140 countries

## Scale

WJP scores are **0–1 scale where 1 = most rule of law adherence**.

Convert to 0–100 for this project:
```
project_score = WJP_Factor3_OpenGov × 100
```

Enter the converted value in `quantitative.value`.

## Key Series

| Field | WJP Variable | Description |
|-------|-------------|-------------|
| `legal_transparency` | Factor 3: Open Government | Publicized laws and government data; right to information; civic participation; complaint mechanisms |
| Supplementary | Factor 1: Constraints on Government Powers | For `institutional_functioning` cross-check |
| Supplementary | Factor 4: Fundamental Rights | For `civil_liberties` cross-check |

## Coverage Gaps

WJP does NOT cover all 39 project countries. Notably absent or intermittently absent:
- **Libya**: Not included (use qualitative fallback)
- **Yemen**: Not included regularly (use qualitative fallback)
- **Syria**: Not included (use qualitative fallback)
- **South Sudan**: Intermittent; check year-by-year
- **Burkina Faso, CAR, DRC**: Intermittent

When a country is absent from WJP: set `data_status: missing`, note the gap, and use `source-qualitative` for the entry.

## Survey Years

| Year | Notes |
|------|-------|
| 2008, 2009, 2010 | First three editions; limited countries |
| 2011, 2012 | Not published |
| 2013 | Resumed with expanded coverage |
| 2014–present | Annual |

For gap years (2011, 2012), interpolate between 2010 and 2013 if needed; set `reliability: medium` and note interpolation.

### Interpolation YAML example (for gap years 2011, 2012):

```yaml
data_status: partial
quantitative:
  value: 42.0   # linear interpolation between WJP 2010 and WJP 2013 values
  unit: score_0_100
  source:
    citation: "Interpolated between WJP 2010 (Factor 3 = X) and WJP 2013 (Factor 3 = Y)"
    url: null
    access_date: null
  reliability: medium
qualitative:
  notes: "Linearly interpolated — WJP not published in 2011-2012"
```

## Citation Format

```yaml
citation: "WJP Rule of Law Index <year>, Factor 3: Open Government, <country>"
url: "https://worldjusticeproject.org/rule-of-law-index"
access_date: "<YYYY-MM-DD>"
type: index_dataset
reliability: medium
```

> **URL is mandatory.** Use `https://worldjusticeproject.org/rule-of-law-index` or the country-specific page. Never leave `url: null`.

## Reliability Notes

- WJP uses expert surveys and household surveys; broadly credible
- Reliability: **medium** — perception-based measures have limitations
- Factor 3 specifically measures transparency practices rather than outcomes; suits `legal_transparency` well

## Qualitative Fallback for Missing Countries

For countries not in WJP:
1. Use constitution text: Does it guarantee right to information? (yes/no)
2. Use national legislation: Is there a Freedom of Information Act?
3. Use US State Department reports (Country Reports on Human Rights Practices) for legal transparency
4. Note with `source: inferred` and `confidence: low`

## Quick Lookup Steps

1. Go to https://worldjusticeproject.org/rule-of-law-index/downloads
2. Download the Excel file for the relevant year
3. Find the country row → find **"Factor 3: Open Government"** column (verify the header — column positions shift between versions)
4. Read the raw value (0–1) → multiply by 100 → enter as `quantitative.value`
5. Sanity check: result should be between 0 and 100; if it looks like 0.42, you forgot the ×100

$ARGUMENTS
