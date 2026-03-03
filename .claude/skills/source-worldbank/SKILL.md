---
name: source-worldbank
layer: 1-source
purpose: How to source World Bank WDI indicators across all project dimensions
indicators: [gdp_per_capita, trade_openness, fdi, statistical_transparency, unemployment, net_migration, remittances, brain_drain, youth_unemployment, gini, natural_resource_rents, life_expectancy, infant_mortality, internet_users, mobile_subscriptions, health_expenditure, education_expenditure]
used_by: [collect-data]
---

# Source: World Bank Open Data (WDI)

## What It Measures

The World Bank World Development Indicators (WDI) is the primary source for macroeconomic and
development statistics. It covers GDP, labor markets, demographics, social services, environment,
and migration across ~200 countries from 1960 to present.

## Access

- **Portal**: https://data.worldbank.org
- **API**: `https://api.worldbank.org/v2/country/<iso2>/indicator/<series>?format=json&date=<start>:<end>&per_page=100`
- **Download**: CSV or Excel for any indicator × country × year range from the portal
- **Coverage**: Annual; most series 1960–present; some start later

## ⚠️ Always Read the Footnotes

World Bank indicator pages display **footnotes** at the bottom of the data table. These are
critical and frequently contain methodology breaks, revision notices, and coverage caveats.

**Types of footnotes to watch for:**
- **Series break**: Definition or methodology changed mid-series, creating a discontinuity
- **Revision**: Preliminary value later revised; earlier accessed values may be stale
- **Coverage caveat**: "Covers metropolitan area only"; "Excludes informal sector"
- **Currency/base year change**: GDP deflator rebased, CPI base year changed
- **Off-cycle update**: Some series update asynchronously (not all in one annual release)

**Protocol**: Always scroll to footnotes when reading the data table. If a footnote applies to
your country-year, copy the key text into `qualitative.notes`.

API responses include a `footnote` field per observation — check it even via API.

---

## Key Series Reference

### Existing Indicators (currently in use)

| Indicator | WDI Series | Unit | Notes |
|-----------|-----------|------|-------|
| `gdp_per_capita` | `NY.GDP.PCAP.CD` | USD current | |
| `unemployment` | `SL.UEM.TOTL.ZS` | % labor force | ILO modeled |
| `trade_openness` | `NE.TRD.GNFS.ZS` | % GDP | (X+M)/GDP |
| `fdi` | `BX.KLT.DINV.WD.GD.ZS` | % GDP | can be negative |
| `statistical_transparency` | `IQ.SCI.OVRL` | 0–100 | discontinued 2021 |

### Population Mobility (new `population_mobility` dimension)

| Indicator | WDI Series | Unit | Notes |
|-----------|-----------|------|-------|
| `net_migration` | `SM.POP.NETM` | persons (5-yr sum) | divide by 5 for annual |
| `remittances` | `BX.TRF.PWKR.DT.GD.ZS` | % GDP | check footnotes for methodology changes |
| `brain_drain` | `SM.EMI.TERT.ZS` | % tertiary-educated | sparse (~2000, ~2010 only) |

**Net migration note**: `SM.POP.NETM` is a 5-year cumulative sum (e.g., 2015 covers 2010–2015).
Divide by 5 for annual estimate. For per-1,000-population rate: also divide by `SP.POP.TOTL`.

**Remittances footnote warning**: Frequently revised as countries add informal channels (mobile
money, hawala). A sudden jump may be a methodology change, not a real-world event.

### Human Development / Social (proposed new dimension or additions)

| Indicator | WDI Series | Unit | Notes |
|-----------|-----------|------|-------|
| `youth_unemployment` | `SL.UEM.1524.ZS` | % youth labor force | ages 15–24, ILO modeled |
| `gini` | `SI.POV.GINI` | 0–100 Gini coefficient | survey years; often gaps |
| `life_expectancy` | `SP.DYN.LE00.IN` | years at birth | combined sexes |
| `infant_mortality` | `SP.DYN.IMRT.IN` | per 1,000 live births | |
| `internet_users` | `IT.NET.USER.ZS` | % of population | ITU source |
| `mobile_subscriptions` | `IT.CEL.SETS.P2` | per 100 people | can exceed 100 (multi-SIM) |
| `health_expenditure` | `SH.XPD.CHEX.GD.ZS` | % GDP | current health expenditure |
| `education_expenditure` | `SE.XPD.TOTL.GD.ZS` | % GDP | government expenditure |

### Natural Resource / Energy (proposed addition to `economic`)

| Indicator | WDI Series | Unit | Notes |
|-----------|-----------|------|-------|
| `natural_resource_rents` | `NY.GDP.TOTL.RT.ZS` | % GDP | sum of 5 sub-components |
| — oil rents component | `NY.GDP.PETR.RT.ZS` | % GDP | |
| — gas rents component | `NY.GDP.NGAS.RT.ZS` | % GDP | |
| — coal rents component | `NY.GDP.COAL.RT.ZS` | % GDP | |
| — mineral rents component | `NY.GDP.MINR.RT.ZS` | % GDP | |
| — forest rents component | `NY.GDP.FRST.RT.ZS` | % GDP | |

**Formula**: `natural_resource_rents = sum of all 5 component rents`
Each component is already expressed as % of GDP. The sum equals the total rents series.
Collect all five components — they reveal the resource mix (oil vs. minerals vs. forest).

### Inequality (proposed addition to `economic` or new `social`)

| Indicator | WDI Series | Unit | Notes |
|-----------|-----------|------|-------|
| `gini` | `SI.POV.GINI` | Gini 0–100 | sparse; survey-based |
| — income share bottom 20% | `SI.DST.FRST.20` | % national income | |
| — income share top 20% | `SI.DST.05TH.20` | % national income | |

**GINI gap warning**: WDI Gini data has large year gaps for most developing countries (surveys
every 3–10 years). Do not interpolate; enter available years only and note the gap. The survey
year (which may differ from the reporting year) is in the footnotes — always record it.

### Component / Denominator Series (shared across indicators)

These are not standalone indicators but are needed as components for multiple indicators.
Collect them into `shared/base_variables.yaml` once — see source-components SKILL.md.

| Variable | WDI Series | Unit | Used by |
|----------|-----------|------|---------|
| `population` | `SP.POP.TOTL` | persons | gdp_per_capita, unemployment, trade_openness, fdi, refugee_flows, net_migration, emigration_rate, immigration_rate, political_violence, internet_users, mobile_subscriptions, military_expenditure |
| `gdp_current_usd` | `NY.GDP.MKTP.CD` | current USD | gdp_per_capita, trade_openness, fdi, health_expenditure, education_expenditure, military_expenditure, remittances, natural_resource_rents |
| `exports_usd` | `NE.EXP.GNFS.CD` | current USD | trade_openness |
| `imports_usd` | `NE.IMP.GNFS.CD` | current USD | trade_openness |
| `fdi_net_inflows_usd` | `BX.KLT.DINV.CD.WD` | current USD | fdi |
| `health_expenditure_usd` | `SH.XPD.CHEX.CD` | current USD | health_expenditure |
| `internet_users_count` | `IT.NET.USER.NB` | persons | internet_users |
| `mobile_subscriptions_total` | `IT.CEL.SETS` | subscriptions | mobile_subscriptions |
| `life_expectancy_male` | `SP.DYN.LE00.MA.IN` | years | life_expectancy |
| `life_expectancy_female` | `SP.DYN.LE00.FE.IN` | years | life_expectancy |

---

## Reliability by Series Type

| Category | Reliability | Notes |
|----------|-------------|-------|
| GDP, trade, FDI | **high** | National accounts, official sources |
| Unemployment, youth unemployment | **medium–high** | ILO modeled; conflict states lower |
| Remittances | **medium** | Informal channels historically undercounted |
| Net migration | **medium** | Residual estimate, not direct counts; 5-year resolution |
| GINI | **medium** | Survey-based; gaps; methodology varies by country |
| Life expectancy, infant mortality | **high** | Well-established vital statistics methodology |
| Internet/mobile | **high** | ITU reporting; some gaps for conflict states |
| Health/education expenditure | **medium–high** | Government budget reporting; off-budget items missed |
| Natural resource rents | **high** | Price × quantity methodology; oil price volatility affects year-to-year |
| Brain drain | **medium** | OECD DIOC–derived; undercounts non-OECD destinations |

---

## Coverage Gaps

- **Conflict states**: Syria 2013+, Yemen 2015+, Libya 2011+, Afghanistan 2022+ — widespread gaps
- **Statistical transparency (IQ.SCI.OVRL)**: Discontinued after 2020
- **GINI**: Most countries have 3–10 year survey gaps; do not interpolate
- **Brain drain (SM.EMI.TERT.ZS)**: Only two global data rounds (~2000, ~2010)
- **Net migration (SM.POP.NETM)**: 5-year intervals only; annual precision not available
- **Natural resource rents**: Pre-1970 data sparse; compute from OPEC/EIA historical prices if needed

---

## Citation Format

```yaml
citation: "World Bank WDI, <Series Code>, <country>, <year>, accessed <YYYY-MM-DD>"
url: "https://data.worldbank.org/indicator/<Series Code>"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: high
```

If a footnote applies:
```yaml
citation: "World Bank WDI, BX.TRF.PWKR.DT.GD.ZS, Tunisia, 2011, accessed 2026-03-02"
url: "https://data.worldbank.org/indicator/BX.TRF.PWKR.DT.GD.ZS"
access_date: "2026-03-02"
# in qualitative.notes:
notes: "WB footnote (2014 revision): 2011 value revised upward to include informal hawala transfers"
```

---

## Quick Lookup Steps

1. Go to `https://data.worldbank.org/indicator/<series-code>`
2. Filter by country → open the data tab
3. Find the year row → copy the value
4. **Scroll to the bottom and read all footnotes**; if one applies to your country-year, note it
5. For component series: collect all listed components into `shared/base_variables.yaml` or
   `quantitative.components` — do not skip components
6. Record the access date for the citation
