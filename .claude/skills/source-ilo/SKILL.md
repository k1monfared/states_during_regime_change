---
name: source-ilo
layer: 1-source
purpose: How to source ILO ILOSTAT data for labor market indicators — employment, labor force participation, informal economy
indicators: [total_population, working_age_population, labor_force_participation, employment, informal_economy, unemployment]
used_by: [collect-data]
---

# Source: ILO ILOSTAT — Labor Market Data

## What It Measures

The International Labour Organization (ILO) ILOSTAT database is the global authority on labor
market statistics. It covers employment, unemployment, labor force participation, wages, working
conditions, and — critically for regime change analysis — the **informal economy**.

For this project, ILO is the primary source for:
- `total_population` — population by age group and sex (ILO uses UN WPP)
- `working_age_population` — working-age persons (15–64 or 15+)
- `labor_force_participation` — share of working-age population in the labor force
- `employment` — employment-to-population ratio
- `informal_economy` — share of employment in the informal sector (or informal economy % GDP)
- `unemployment` — components (unemployed persons + labor force) feeding the main WDI indicator

## Access

- **Portal**: https://ilostat.ilo.org
- **Data explorer**: https://ilostat.ilo.org/data/
- **API**: https://ilostat.ilo.org/resources/ilostat-developer-guide/ (free, no key)
- **Bulk download**: https://ilostat.ilo.org/bulk-download/ (annual data packs by topic)
- **Coverage**: Annual; many series from 1990 or earlier; updated continuously

## Key Series Codes

### Population and Working-Age

| Variable | ILO Series Code | Unit | Notes |
|----------|----------------|------|-------|
| `total_population` | `POP_XWAP_SEX_AGE_NB` (15+) | thousands | also use UN WPP or WB SP.POP.TOTL |
| `working_age_population_15_64` | `POP_XWAP_SEX_AGE_NB` (filter age=15-64) | thousands | |
| `working_age_population_15plus` | `POP_XWAP_SEX_AGE_NB` (filter age=15+) | thousands | broader measure |

**Preferred for total population**: World Bank `SP.POP.TOTL` (same underlying UN WPP data but
more accessible). Use ILO for age-group breakdowns.

### Labor Force and Employment

| Variable | ILO Series Code | Unit | Notes |
|----------|----------------|------|-------|
| `labor_force_total` | `EAP_TEAP_SEX_AGE_NB` | thousands | employed + unemployed |
| `labor_force_participation_rate` | `EAP_TEAP_SEX_AGE_RT` | % working-age pop | |
| `employed_persons` | `EMP_TEMP_SEX_AGE_NB` | thousands | all employed |
| `employment_to_population_ratio` | `EMP_TEMP_SEX_AGE_RT` | % working-age pop | |
| `unemployed_persons` | `UNE_TUNE_SEX_AGE_NB` | thousands | ILO definition |
| `unemployment_rate` | `UNE_TUNE_SEX_AGE_RT` | % labor force | same as WB SL.UEM.TOTL.ZS |

### Informal Economy

| Variable | ILO Series Code | Unit | Notes |
|----------|----------------|------|-------|
| `informal_employment_total` | `EMP_2EMP_SEX_ECO_NB` (informal) | thousands | employees in informal sector |
| `informal_employment_rate` | `EMP_2EMP_SEX_ECO_RT` (informal) | % total employment | **primary informal metric** |
| `self_employed` | `EMP_TEMP_SEX_STE_NB` (status=self-employed) | thousands | crude informal proxy |
| `contributing_family_workers` | `EMP_TEMP_SEX_STE_NB` (status=contributing family) | thousands | informal indicator |

**For informal economy as % of GDP** (not employment): Use IMF/Schneider estimates — see below.

---

## Informal Economy: Two Measures

The "informal economy" can be measured in two complementary ways:

### 1. Informal Employment Rate (% of total employment)
- **Source**: ILO ILOSTAT `EMP_2EMP_SEX_ECO_RT` filtered to informal sector
- **Definition**: Workers in jobs that lack legal or social protection (no contract, no social
  security, often in household enterprises or small unregistered businesses)
- **Coverage**: ILO has estimates for ~100+ countries; sparser for MENA/SSA conflict zones
- **Reliability**: **medium** — survey-based; methodology varies across countries
- **Formula**: `informal_employment_rate = (informal_employees / total_employed) × 100`

### 2. Shadow Economy as % of GDP
- **Source**: IMF Working Paper estimates (Medina & Schneider, periodically updated)
  - Download from: https://www.imf.org/en/Publications/WP/Issues/2018/01/25/Shadow-Economies-Around-the-World-What-Did-We-Learn-Over-the-Last-20-Years-45583
  - World Bank also republishes: https://datacatalog.worldbank.org (search "shadow economy")
- **Definition**: Economic activity not captured in official GDP — includes unreported businesses,
  tax evasion, informal transactions; **excludes** illegal activity
- **Coverage**: ~158 countries, 1991–recent; updated every few years
- **Reliability**: **medium** — model-based estimate (MIMIC method); not direct measurement
- **Formula**: Econometric model combining tax burden, regulation, unemployment, etc.

**Use both when available**: informal employment rate (ILO) measures the labor market dimension;
shadow economy % GDP (IMF/Schneider) measures the output dimension. They tell different stories
and can diverge significantly.

---

## Formulas and Components

### labor_force_participation
```
labor_force_participation_rate = (labor_force_total / working_age_population) × 100
```
Components: `labor_force_total` (ILO EAP_TEAP_SEX_AGE_NB), `working_age_population_15plus`

### employment
```
employment_to_population_ratio = (employed_persons / working_age_population) × 100
```
Components: `employed_persons` (ILO EMP_TEMP_SEX_AGE_NB), `working_age_population_15plus`

### informal_economy (employment rate)
```
informal_employment_rate = (informal_employed / total_employed) × 100
```
Components: `informal_employed` (ILO EMP_2EMP), `total_employed` (ILO EMP_TEMP)

### working_age_population
```
working_age_population_pct = (working_age_15_64 / total_population) × 100
```
Components: `working_age_15_64` (ILO or WB SP.POP.1564.TO), `total_population` (WB SP.POP.TOTL)

---

## Reliability

- Labor force participation rate: **medium–high** for countries with regular labor surveys;
  **low** for conflict states where surveys are disrupted
- Employment-to-population ratio: same as LFP rate
- Informal employment rate: **medium** — ILO has formal methodology but coverage is uneven;
  many developing countries in this project have estimates only for recent years (2005+)
- Shadow economy % GDP: **medium** — model-derived, not measured; useful for trends not precision

---

## Coverage Gaps

- **Conflict states**: Labor surveys cease during major conflicts; ILO uses modeled estimates
  (flag as `reliability: low` and note "ILO modeled estimate; active conflict disrupts surveys")
- **Informal economy data**: Many countries lack formal ILO informal employment series before
  2000; use Schneider shadow economy estimates as fallback
- **Pre-1990**: Limited coverage for most developing countries; use census-based estimates
  and note the source

---

## Feature Vocabulary

### labor_force_participation_rate (% of working-age pop)
| Rate | Feature tag |
|------|-------------|
| > 70% | `high_participation` |
| 60–70% | `moderate_participation` |
| 50–60% | `low_participation` |
| < 50% | `very_low_participation` |
| Falling fast (>5% in 3yr) | `participation_collapse` |

### employment_to_population_ratio (% of working-age pop)
| Rate | Feature tag |
|------|-------------|
| > 65% | `high_employment` |
| 55–65% | `moderate_employment` |
| 45–55% | `low_employment` |
| < 45% | `very_low_employment` |

### informal_economy (% of employment or % of GDP)
| Rate | Feature tag |
|------|-------------|
| < 20% | `small_informal_sector` |
| 20–40% | `moderate_informal_sector` |
| 40–60% | `large_informal_sector` |
| > 60% | `dominant_informal_sector` |
| Growing + crisis context | `informalization_crisis` |

---

## Citation Format

```yaml
# ILO ILOSTAT:
citation: "ILO ILOSTAT, <series_code>, <country>, <year>, accessed <date>"
url: "https://ilostat.ilo.org/data/"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: medium

# IMF/Schneider shadow economy:
citation: "Medina & Schneider (IMF WP/18/17), Shadow Economy estimates, <country>, <year>"
url: "https://www.imf.org/en/Publications/WP/Issues/2018/01/25/Shadow-Economies-Around-the-World"
access_date: "<YYYY-MM-DD>"
type: academic_estimate
reliability: medium
```

---

## Quick Lookup Steps

### Labor force / employment (ILO ILOSTAT):
1. Go to https://ilostat.ilo.org/data/
2. Select topic: "Employment" or "Labour force" or "Unemployment"
3. Filter by country, year, and "Total" for sex and age 15+
4. Download or copy the value; note the series code
5. Check coverage flag — if "estimate" or "modeled", note lower reliability

### Informal employment (ILO):
1. Go to https://ilostat.ilo.org/data/ → select "Informality"
2. Series: "Employment in the informal sector" or "Informal employment"
3. Filter by country → read % of total employment
4. If unavailable: use self-employment rate (SL.EMP.SELF.ZS from WB) as crude proxy
   and note: "Formal informal employment data not available; self-employment used as proxy"

### Shadow economy % GDP (Schneider/IMF):
1. Download Medina & Schneider dataset from IMF website (link above)
2. Find country row × year column
3. Enter as % of GDP; cite as academic estimate with medium reliability

$ARGUMENTS
