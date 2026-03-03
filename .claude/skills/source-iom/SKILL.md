---
name: source-iom
layer: 1-source
purpose: How to source emigration_rate and immigration_rate for the population_mobility dimension
indicators: [emigration_rate, immigration_rate, net_migration]
used_by: [collect-data]
---

# Source: IOM and UN DESA Migration Data

## What It Measures

IOM (International Organization for Migration) and the UN Department of Economic and Social
Affairs (UN DESA) track international migration stocks and flows. For this project:

- `emigration_rate`: Annual outward migration as % of total population
- `immigration_rate`: Annual inward migration as % of total population
- `net_migration`: The balance (immigrants minus emigrants) per 1,000 population per year

These capture **voluntary** population movement — distinct from `refugee_flows` which tracks
forced conflict-driven displacement.

## Access

### UN DESA — International Migrant Stock
- **Portal**: https://www.un.org/development/desa/pd/content/international-migrant-stock
- **Data file**: Download "International migrant stock by destination and origin (xlsx)"
- **Coverage**: Bi-annual estimates (2000, 2005, 2010, 2015, 2019, 2020); must interpolate for other years
- **Series**: Total migrants by destination country (immigration stock); by origin country (emigration stock)
- **Note**: These are **stock** figures (total living abroad), not annual flows.

### World Bank — Net Migration
- **Portal**: https://data.worldbank.org/indicator/SM.POP.NETM
- **Series**: `SM.POP.NETM` — Net migration (total persons, 5-year sum)
- **Coverage**: 1960–present in 5-year intervals; must divide by 5 for annual estimate
- **Caveat**: The 5-year grouping means precision is limited; use for trend direction, not precise year values

### IOM — World Migration Report
- **Portal**: https://worldmigrationreport.iom.int
- **Coverage**: Key statistics on major migration corridors; less granular but contextually rich
- **Use for**: Qualitative assessment, major trend identification, crisis-year narrative

### IOM — Global Migration Data Portal
- **Portal**: https://www.migrationdataportal.org
- **API**: Available at https://www.migrationdataportal.org/api/index
- **Series available**: Emigration rate, immigration rate, net migration rate
- **Coverage**: Varies by country and year; stronger for recent decades

## Key Metrics and Computation

### Emigration Rate
```
emigration_rate = (emigrants_stock_t1 - emigrants_stock_t0) / population × 100
```
Or use direct rate series from IOM Migration Data Portal when available.

**Emigrants stock**: Total persons born in or citizens of country X currently living abroad.
Source: UN DESA migrant stock table, filtered by "country of origin".

### Immigration Rate
```
immigration_rate = (immigrants_stock_t1 - immigrants_stock_t0) / population × 100
```

**Immigrants stock**: Total foreign-born or foreign nationals living in country X.
Source: UN DESA migrant stock table, filtered by "destination country".

### Net Migration Rate (per 1,000)
```
net_migration_rate = (net_migrants_5yr / 5) / population × 1000
```
Source: World Bank `SM.POP.NETM` ÷ 5 ÷ population.
Positive = more people arriving; negative = more people leaving.

## Reliability

- UN DESA stocks: **medium** — census-based estimates; conflict countries have gaps
- World Bank net migration: **medium** — derived from population balances (residual method); not direct counts
- IOM Data Portal rates: **medium** — compiled from multiple national sources; methodology varies
- For conflict states (Syria, Yemen, Afghanistan post-2015): **low** — estimates only; wide uncertainty

## Coverage Gaps

- **Active conflict zones**: Syria 2012+, Yemen 2015+, Libya 2011+, Afghanistan 2021+ — data is
  fragmentary. Use IOM emergency tracking or UNHCR estimates and note low reliability.
- **Pre-2000**: UN DESA stock estimates exist for 1990 and 1995; for earlier years use census
  reports or academic sources if available.
- **Annual vs. quinquennial**: Most series are 5-year or bi-annual. For regime change analysis
  requiring year-by-year data, interpolate linearly between observation points and note in `qualitative.notes`.

## Feature Vocabulary (population_mobility dimension)

### emigration_rate (% of population per year)
| Rate | Feature tag |
|------|-------------|
| Net returns / <0.1% outflow | `net_inflow_or_stable` |
| 0.1–0.5% outflow | `low_emigration` |
| 0.5–1.5% outflow | `moderate_emigration` |
| 1.5–3% outflow | `elevated_emigration` |
| 3–7% outflow | `high_emigration` |
| >7% outflow | `mass_exodus` |

### immigration_rate (% of population per year)
| Rate | Feature tag |
|------|-------------|
| <0.1% inflow | `minimal_inflow` |
| 0.1–0.5% inflow | `low_immigration` |
| 0.5–1.5% inflow | `moderate_immigration` |
| >1.5% inflow | `high_immigration` |
| Diaspora return dominant | `diaspora_return` |

### net_migration_rate (per 1,000 population per year)
| Rate | Feature tag |
|------|-------------|
| >+5 | `strong_net_inflow` |
| +1 to +5 | `mild_net_inflow` |
| -1 to +1 | `roughly_stable` |
| -5 to -1 | `mild_net_outflow` |
| -15 to -5 | `significant_net_outflow` |
| < -15 | `severe_net_outflow` |

## Citation Format

```yaml
# UN DESA:
citation: "UN DESA, International Migrant Stock 2020, <country>, country of origin table"
url: "https://www.un.org/development/desa/pd/content/international-migrant-stock"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: medium

# World Bank net migration:
citation: "World Bank WDI, SM.POP.NETM, <country>, <year range>, accessed <date>"
url: "https://data.worldbank.org/indicator/SM.POP.NETM"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: medium

# IOM Migration Data Portal:
citation: "IOM Global Migration Data Portal, emigration rate, <country>, <year>"
url: "https://www.migrationdataportal.org"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: medium
```

> **URL is mandatory.** Use the specific dataset page for each source listed above. Never leave `url: null`.

## Quick Lookup Steps

### For net_migration (World Bank):
1. Go to https://data.worldbank.org/indicator/SM.POP.NETM
2. Filter by country → read the 5-year period value
3. Divide by 5 to get annual estimate
4. Divide by population (World Bank SP.POP.TOTL) × 1000 for rate per 1,000

### For emigration_rate / immigration_rate (IOM Portal):
1. Go to https://www.migrationdataportal.org
2. Search country → select "Emigration rate" or "Immigration rate"
3. Read the year value directly if available
4. If not available, use UN DESA migrant stock method above

### For UN DESA stock method:
1. Download the Excel from https://www.un.org/development/desa/pd/content/international-migrant-stock
2. Tab "Table 1" (destination) for immigration stock; "Table 2" (origin) for emigration stock
3. Find the country row, read the nearest year column
4. Compute annual flow: (stock_t1 - stock_t0) / years / population × 100

$ARGUMENTS
