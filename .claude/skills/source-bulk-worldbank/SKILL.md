---
name: source-bulk-worldbank
layer: 1-source
purpose: Download World Bank WDI and WGI series in bulk for all 40 countries
used_by: [pipeline, manage-coverage]
---

# World Bank Bulk Download Workflow

## Quick start

```bash
python3 data/scripts/download_canonical.py --status          # what's downloaded
python3 data/scripts/download_canonical.py --source worldbank --priority 1 --dry-run
python3 data/scripts/download_canonical.py --source worldbank --priority 1
python3 data/scripts/build_coverage.py                       # rebuild after download
python3 data/scripts/export_web.py                           # update dashboard files
```

## Current status (2026-03-03)

38 of 88 WB series downloaded. All 39 priority-1 series attempted; 38 succeeded.
`WB_SM.POP.REFG.OR` (refugees as % population) returns no data from the WB API — use UNHCR directly.

## Downloaded series (38 total)

### Economy
| Series ID | WB Code | Description | Feeds indicator |
|-----------|---------|-------------|----------------|
| WB_NY.GDP.MKTP.CD | NY.GDP.MKTP.CD | GDP, current USD | gdp_per_capita, trade_openness |
| WB_NY.GDP.MKTP.KD | NY.GDP.MKTP.KD | GDP, constant 2015 USD | trend analysis |
| WB_NY.GDP.PCAP.CD | NY.GDP.PCAP.CD | GDP per capita, current USD | gdp_per_capita |
| WB_NY.GDP.PCAP.KD | NY.GDP.PCAP.KD | GDP per capita, constant 2015 USD | — |
| WB_NY.GDP.PCAP.PP.CD | NY.GDP.PCAP.PP.CD | GDP per capita, PPP | gini_adjusted_gdp_per_capita_ppp |
| WB_FP.CPI.TOTL | FP.CPI.TOTL | CPI index (2010=100) | inflation component |
| WB_FP.CPI.TOTL.ZG | FP.CPI.TOTL.ZG | Inflation rate (annual %) | inflation |
| WB_NE.EXP.GNFS.CD | NE.EXP.GNFS.CD | Exports, goods+services (USD) | trade_openness |
| WB_NE.IMP.GNFS.CD | NE.IMP.GNFS.CD | Imports, goods+services (USD) | trade_openness |
| WB_NE.TRD.GNFS.ZS | NE.TRD.GNFS.ZS | Trade (% GDP) | trade_openness |
| WB_BX.KLT.DINV.CD.WD | BX.KLT.DINV.CD.WD | FDI, net inflows (USD) | fdi |
| WB_BX.TRF.PWKR.CD.DT | BX.TRF.PWKR.CD.DT | Remittances received (USD) | remittances |
| WB_GC.DOD.TOTL.GD.ZS | GC.DOD.TOTL.GD.ZS | Central govt debt (% GDP) | fiscal_health |
| WB_NY.GDP.TOTL.RT.ZS | NY.GDP.TOTL.RT.ZS | Total natural resource rents (% GDP) | natural_resource_rents |
| WB_NY.GDP.PETR.RT.ZS | NY.GDP.PETR.RT.ZS | Oil rents (% GDP) | natural_resource_rents sub |
| WB_NY.GDP.NGAS.RT.ZS | NY.GDP.NGAS.RT.ZS | Gas rents (% GDP) | natural_resource_rents sub |
| WB_TX.VAL.MANF.ZS.UN | TX.VAL.MANF.ZS.UN | Manufactures exports (% merch exports) | export_diversification |

### Labor
| Series ID | WB Code | Description | Feeds indicator |
|-----------|---------|-------------|----------------|
| WB_SL.TLF.TOTL.IN | SL.TLF.TOTL.IN | Labor force, total | unemployment denominator |
| WB_SL.TLF.CACT.ZS | SL.TLF.CACT.ZS | Labor force participation rate (%) | labor_force_participation |
| WB_SL.UEM.TOTL.ZS | SL.UEM.TOTL.ZS | Unemployment rate, WB modeled (%) | unemployment |
| WB_SL.UEM.1524.ZS | SL.UEM.1524.ZS | Youth unemployment rate, 15-24 (%) | youth_unemployment |
| WB_SL.UEM.NEET.ZS | SL.UEM.NEET.ZS | NEET rate (%) | neet_rate |

### Social & Health
| Series ID | WB Code | Description | Feeds indicator |
|-----------|---------|-------------|----------------|
| WB_SP.POP.TOTL | SP.POP.TOTL | Population, total | denominator for many |
| WB_SP.DYN.LE00.IN | SP.DYN.LE00.IN | Life expectancy at birth (years) | hdi, life_expectancy |
| WB_SP.DYN.IMRT.IN | SP.DYN.IMRT.IN | Infant mortality (per 1,000 births) | infant_mortality |
| WB_SH.DYN.MORT | SH.DYN.MORT | Under-5 mortality (per 1,000) | — |
| WB_SH.XPD.CHEX.GD.ZS | SH.XPD.CHEX.GD.ZS | Health expenditure (% GDP) | health_expenditure |
| WB_SE.XPD.TOTL.GD.ZS | SE.XPD.TOTL.GD.ZS | Education expenditure (% GDP) | education_expenditure |
| WB_SI.POV.DDAY | SI.POV.DDAY | Poverty headcount at $2.15/day (%) | poverty_rate |
| WB_SI.POV.GINI | SI.POV.GINI | Gini index | gini, gini_adjusted_* |
| WB_IT.NET.USER.ZS | IT.NET.USER.ZS | Internet users (% pop) | internet_users |

### Migration & Conflict
| Series ID | WB Code | Description | Feeds indicator |
|-----------|---------|-------------|----------------|
| WB_SM.POP.NETM | SM.POP.NETM | Net migration, 5-yr sum (persons) | net_migration |
| WB_VC.BTL.DETH | VC.BTL.DETH | Battle-related deaths (WB) | political_violence cross-check |

### Governance (WGI)
| Series ID | WGI Code | Description | Feeds indicator |
|-----------|---------|-------------|----------------|
| WGI_CC | CC.EST | Control of Corruption | control_of_corruption |
| WGI_GE | GE.EST | Government Effectiveness | government_effectiveness |
| WGI_PS | PV.EST | Political Stability (PV) | political_stability |
| WGI_RL | RL.EST | Rule of Law | — |
| WGI_VA | VA.EST | Voice and Accountability | — |

## Not yet downloaded — priority 2 WB series (50 remaining)

Run to get them:
```bash
python3 data/scripts/download_canonical.py --source worldbank --priority 2
```

Key ones:
- Demographics breakdown: SP.POP.1564.TO (working-age), SP.POP.0014.TO, SP.POP.GROW
- Education: SE.PRM.ENRR, SE.SEC.ENRR, SE.TER.ENRR (gross enrollment)
- Labor: SL.EMP.SELF.ZS (self-employed, informal proxy), SL.EMP.TOTL.SP.ZS
- Health: SH.STA.MMRT (maternal mortality), SH.H2O.BASW.ZS (water access)
- Economy: NY.GDP.COAL.RT.ZS, NY.GDP.MINR.RT.ZS, NY.GDP.FRST.RT.ZS (rents sub-components)
- Migration: SM.POP.TOTL (migrant stock)

## API details

- URL: `https://api.worldbank.org/v2/country/{iso3s}/indicator/{code}?format=json&per_page=20000`
- All 40 countries batched in a single call with semicolon-separated ISO3 codes
- Rate limit: ~5 req/sec; script waits 0.3s between requests
- Coverage: annual, 1960-present for most series; WGI starts 1996

## Canonical CSV format

```csv
iso3,country_id,year,value,status,download_date,notes
IRQ,iraq,2003,25175000.0,available,2026-03-03,
SYR,syria,2013,,source_gap,,WB no estimate
```

Status values: `available`, `source_gap`, `not_in_source`, `download_error`, `pre_coverage`, `estimated`

## After downloading

```bash
python3 data/scripts/build_coverage.py   # rebuild coverage + fundamental.json
python3 data/scripts/compute_derived.py  # fill calculated_value in YAMLs
python3 data/scripts/export_web.py       # update dashboard
```
