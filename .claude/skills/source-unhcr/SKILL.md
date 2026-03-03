---
name: source-unhcr
layer: 1-source
purpose: How to source UNHCR data for refugee_flows
indicators: [refugee_flows]
used_by: [collect-data]
---

# Source: UNHCR Refugee Data Finder

## What It Measures

UNHCR tracks forced displacement globally, including refugees (international), internally displaced persons (IDPs), asylum seekers, and stateless persons. For this project, `refugee_flows` measures annual **new displacement** as a proportion of population.

## Access

- **Portal**: https://data.unhcr.org (Refugee Data Finder)
- **Download**: https://data.unhcr.org/en/dataviz/228 (population data by country, year, demographic)
- **API**: UNHCR Data API at https://api.unhcr.org (free, no key required for basic queries)
- **Coverage**: Annual data from 1951; comprehensive from 1990s; real-time updates for recent years

## What to Measure

The project tracks **net annual new displacement** for the country of origin:

1. **New refugee outflows**: New refugees from country X who fled to other countries in year Y
2. **New IDP flows**: New internally displaced persons within country X in year Y

Primary metric: `new_displacement_per_1000_population`
```
metric = (new_refugees + new_IDPs) / population * 1000
```

If population data is unavailable, use raw counts and note in `qualitative.assessment`.

> **Stock vs. Flow warning**: UNHCR Data Finder defaults to showing the **stock** figure (total refugees currently registered). You need the **flow** figure (new refugees in year Y). Look for the "new displacement" or "newly displaced" filter — it is often not the default view.

Use World Bank population data (`SP.POP.TOTL`) as the denominator for per-capita calculations. Cite both UNHCR and World Bank when computing rates.

## Crosswalk: Displacement Scale → Feature Vocabulary

From `data/config/indicators.yaml` (verify current tags):

| Annual new displacement (% of pop) | Feature tag |
|-------------------------------------|-------------|
| <0.01% | `minimal_displacement` |
| 0.01–0.1% | `moderate_displacement` |
| 0.1–1% | `significant_displacement` |
| 1–5% | `mass_displacement` |
| >5% | `catastrophic_displacement` |
| Cross-border flight dominant | `refugee_exodus` |
| Internal displacement dominant | `internal_displacement_mass` |

Always add both the scale tag and the type tag (refugee vs. IDP) when both apply.

## IDPs vs. International Refugees

**IDPs** (Internally Displaced Persons):
- Fled within their own country
- Tracked by UNHCR's IDP monitoring and IDMC (Internal Displacement Monitoring Centre)
- IDMC: https://www.internal-displacement.org (better IDP data for some countries)

**International Refugees**:
- Fled to another country
- Tracked by UNHCR under the Refugee Convention

For `refugee_flows`, include both. Cite UNHCR for refugees, IDMC for IDPs when using IDMC as primary.

## IDMC — Supplementary IDP Source

- **Portal**: https://www.internal-displacement.org
- **Data**: https://www.internal-displacement.org/database/displacement-data
- **Coverage**: IDP-specific; stronger for conflict-induced displacement; annual since 2003

## Citation Format

```yaml
# UNHCR:
citation: "UNHCR Refugee Data Finder, new refugees from <country>, <year>"
url: "https://data.unhcr.org"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: high

# IDMC (for IDPs):
citation: "IDMC, new internal displacements in <country>, <year>"
url: "https://www.internal-displacement.org"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: high
```

> **URL is mandatory.** Use `https://data.unhcr.org` for UNHCR and `https://www.internal-displacement.org` for IDMC. Never leave `url: null`.

## Reliability Notes

- UNHCR data: **high** for international refugees (registered with UNHCR or partner agencies)
- IDP data: **medium** — IDPs are harder to count; IDMC figures are estimates
- For active conflict years: data may be revised substantially in subsequent UNHCR reports; note "preliminary" if using current-year data
- Zero displacement: countries at peace genuinely have near-zero; `minimal_displacement` is correct

## Quick Lookup Steps

1. Go to https://data.unhcr.org/en/dataviz/228 → filter by country of origin + year → look for **new refugees** (not total stock)
2. For IDPs: go to https://www.internal-displacement.org/database/displacement-data → filter by country + year → read new displacements
3. Get population denominator: https://data.worldbank.org/indicator/SP.POP.TOTL
4. Compute: (new_refugees + new_IDPs) / population × 1000
5. Apply the crosswalk table to select the feature tag
6. Cite both UNHCR and IDMC in sources when both are used

$ARGUMENTS
