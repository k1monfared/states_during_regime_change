---
name: source-vdem
layer: 1-source
purpose: How to source V-Dem data for institutional_functioning and elite_cohesion
indicators: [institutional_functioning, elite_cohesion]
used_by: [collect-data]
---

# Source: V-Dem — Varieties of Democracy Dataset

## What It Measures

The V-Dem project (Gothenburg University) provides the most granular democracy dataset available, with hundreds of variables covering electoral, liberal, participatory, deliberative, and egalitarian dimensions of democracy. For this project, V-Dem is the primary source for `institutional_functioning` and a supplementary source for `elite_cohesion`.

## Access

- **Portal**: https://v-dem.net
- **Download**: https://v-dem.net/data/the-v-dem-dataset (requires free registration; V-Dem Country-Year dataset)
- **Codebook**: Available at the same download page — essential for variable descriptions
- **Coverage**: 1789–present (most variables); 202 countries; annual updates

## Key Variables for This Project

| Indicator | V-Dem Variable | Description | Scale |
|-----------|---------------|-------------|-------|
| `institutional_functioning` | `v2x_libdem` | Liberal democracy index | 0–1 |
| `institutional_functioning` | `v2x_polyarchy` | Electoral democracy index | 0–1 |
| `elite_cohesion` | `v2lgbicam` | Legislature bicameralism (checks) | ordinal |
| `elite_cohesion` | `v2jucomp` | Judicial compliance | ordinal |
| `elite_cohesion` | `v2xel_frefair` | Clean elections | 0–1 |
| Supplementary | `v2x_partipdem` | Participatory democracy | 0–1 |

Use `v2x_libdem` as the primary value for `institutional_functioning` (captures constraints on executive, rule of law, and civil society together).

## Scale Conversion

V-Dem uses 0–1 scale where 1 = most democratic/functional.

Convert to 0–100:
```
project_score = v2x_libdem × 100
```

Enter the converted value (×100) in `quantitative.value`.

## V-Dem for Elite Cohesion

`elite_cohesion` does not have a single clean V-Dem variable. Use a combination:
- `v2xel_frefair` (clean elections) → high value suggests elites accept electoral outcomes
- `v2jucomp` (judicial compliance with executive) → low compliance = judicial independence
- `v2lgbicam` (bicameralism) → higher = more institutional checks between elite factions
- Narrative from `v2x_polyarchy` trajectory — sudden drops signal elite fractures

For `elite_cohesion`, use V-Dem variables primarily to triangulate and support the qualitative assessment from `source-qualitative`.

## Confidence Intervals

V-Dem provides uncertainty estimates (HDI 90% credible intervals) for most variables. If the interval is wide (>0.2), note this in `qualitative.notes` and reduce confidence:
```
notes: "V-Dem v2x_libdem uncertainty interval: 0.18–0.42 (wide); confidence reduced to medium"
```

## Citation Format

```yaml
citation: "V-Dem Dataset v14, <variable>, <country>, <year>. Coppedge et al. (2024)"
url: "https://v-dem.net/data/the-v-dem-dataset"
access_date: "<YYYY-MM-DD>"
type: index_dataset
reliability: high
```

> **URL is mandatory.** Always use `https://v-dem.net/data/the-v-dem-dataset` as the URL. Never leave `url: null`.

The V-Dem team asks for citation of their working paper:
> Coppedge, Michael et al. 2024. V-Dem Codebook v14. Varieties of Democracy (V-Dem) Project.

## Reliability Notes

- **Year-lag**: V-Dem releases in spring of year N cover data through year N-1. Always check the dataset version and coverage cutoff — do not assume the current year is included.
- V-Dem: **high** for most country-years — based on expert surveys with statistical aggregation and calibration
- For recent years (last 1–2 years before publication), reliability is **medium** — fewer expert responses, subject to revision
- V-Dem may not cover recent coups or transitions fully in the same-year dataset; check version release date

## Accessing Specific Variables

The full dataset is large (CSV, several hundred MB). For targeted queries:
1. Use the V-Dem online analysis tool: https://v-dem.net/data/v-dem-online-graphing-analysis-tool
2. Or download and filter with pandas: `df[df['country_name']=='Iraq'][['year','v2x_libdem','v2x_polyarchy']]`

## Quick Lookup Steps

1. Go to https://v-dem.net/data/v-dem-online-graphing-analysis-tool (no download required for single-country lookups)
2. Select country → select variable `v2x_libdem` → select year range
3. Read value (0–1) → multiply by 100 → enter as `quantitative.value`
4. Sanity check: result should be between 0 and 100; if it looks like 0.34, you forgot the ×100
5. For bulk collection: filter the downloaded dataset with `df[df['country_name']=='<Country>'][['year','v2x_libdem']]`
6. Note the dataset version (e.g., v14) and release year in the citation
7. Check HDI credible interval — if width >0.2, set `confidence: medium` and note in `qualitative.notes`

$ARGUMENTS
