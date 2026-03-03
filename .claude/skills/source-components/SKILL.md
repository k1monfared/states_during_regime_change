---
name: source-components
layer: 1-source
purpose: Universal component collection — mandatory for every quantitative indicator; shared variable architecture; formula + role schema
indicators: [all]
used_by: [collect-data]
---

# Universal Component Collection

## Principle

**Component collection is mandatory, not optional.** Every time you collect a quantitative metric,
you must also collect:

1. **All input variables** (numerator parts, denominator parts, addends, etc.)
2. **The formula** used to derive the metric from those inputs
3. **A source citation for each input** independently

This makes every data point:
- **Auditable**: Anyone can recheck the math and verify each input
- **Modifiable**: Alternative metrics (e.g., per-capita vs. absolute, different normalization)
  can be derived without re-fetching data
- **Gap-fillable**: If the direct series has a gap, compute it from components

---

## Architecture: Shared Base Variables

Many indicators share the same denominators (population, GDP). Rather than collecting population
50 times for 50 country-years in 10 different indicator files, maintain a **single shared
variables file** per country that all indicators can reference.

### File location
```
data/raw/<country>/shared/base_variables.yaml
```

### What goes in shared variables

Only variables that appear as **components in 3 or more indicators**:

| Variable | WDI Series | Used as component by |
|----------|-----------|---------------------|
| `population` | `SP.POP.TOTL` | gdp_per_capita, trade_openness, fdi, net_migration, emigration_rate, immigration_rate, refugee_flows, political_violence, internet_users, mobile_subscriptions, military_expenditure, labor_force_participation, employment |
| `gdp_current_usd` | `NY.GDP.MKTP.CD` | gdp_per_capita, trade_openness, fdi, health_expenditure, education_expenditure, military_expenditure, remittances, natural_resource_rents |
| `cpi` | `FP.CPI.TOTL` | inflation (current year and prior year) |
| `working_age_population` | `SP.POP.1564.TO` | labor_force_participation, employment, working_age_population |

### shared/base_variables.yaml schema

```yaml
# Shared base variables for <country>
# Collect these first before any indicator session.
# Indicators reference these via: shared_ref: <variable_name>

country: <country_id>
last_updated: <YYYY-MM-DD>

variables:
  population:
    description: "Total mid-year population (all residents)"
    unit: persons
    series: "World Bank SP.POP.TOTL"
    url: "https://data.worldbank.org/indicator/SP.POP.TOTL"
    reliability: high
    data:
      1990:
        value: 18500000
        source:
          citation: "World Bank WDI, SP.POP.TOTL, <country>, 1990, accessed <date>"
          access_date: "<YYYY-MM-DD>"
        footnote: null
      1991:
        value: 18900000
        source:
          citation: "World Bank WDI, SP.POP.TOTL, <country>, 1991, accessed <date>"
          access_date: "<YYYY-MM-DD>"
        footnote: null
      # ... continue for all years in time_range

  gdp_current_usd:
    description: "Gross Domestic Product at current market prices"
    unit: usd_current
    series: "World Bank NY.GDP.MKTP.CD"
    url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD"
    reliability: high
    data:
      1990:
        value: 25000000000
        source:
          citation: "World Bank WDI, NY.GDP.MKTP.CD, <country>, 1990, accessed <date>"
          access_date: "<YYYY-MM-DD>"
        footnote: null

  cpi:
    description: "Consumer Price Index (2010=100)"
    unit: index_2010_eq_100
    series: "World Bank FP.CPI.TOTL"
    url: "https://data.worldbank.org/indicator/FP.CPI.TOTL"
    reliability: high
    data:
      1990:
        value: 42.3
        source:
          citation: "World Bank WDI, FP.CPI.TOTL, <country>, 1990, accessed <date>"
          access_date: "<YYYY-MM-DD>"
        footnote: null

  working_age_population:
    description: "Population aged 15-64 (working-age)"
    unit: persons
    series: "World Bank SP.POP.1564.TO"
    url: "https://data.worldbank.org/indicator/SP.POP.1564.TO"
    reliability: high
    data:
      1990:
        value: 11200000
        source:
          citation: "World Bank WDI, SP.POP.1564.TO, <country>, 1990, accessed <date>"
          access_date: "<YYYY-MM-DD>"
        footnote: null
```

### Referencing shared variables in indicator YAML

When a component value is already in `shared/base_variables.yaml`, use `shared_ref` instead of
re-entering the value:

```yaml
      components:
        gdp_current_usd:
          shared_ref: gdp_current_usd   # look up from shared/base_variables.yaml for this year
          role: denominator
        population:
          shared_ref: population
          role: denominator
        fdi_net_inflows_usd:            # not in shared — enter inline
          value: 842000000
          unit: usd_current
          role: numerator
          source:
            citation: "World Bank WDI, BX.KLT.DINV.CD.WD, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/BX.KLT.DINV.CD.WD"
            access_date: "2026-03-02"
          reliability: high
```

---

## YAML Component Schema

The full quantitative block with formula, components, and roles:

```yaml
  <year>:
    data_status: complete
    quantitative:
      value: <main_metric_value>
      unit: <unit>
      formula: "<expression showing how value is derived from component names>"
      source:
        citation: "..."
        url: "..."
        access_date: "YYYY-MM-DD"
      reliability: <high|medium|low>
      components:
        <component_name>:
          value: <number>          # omit if using shared_ref
          shared_ref: <var_name>   # omit if providing value inline
          unit: <unit>
          role: <see role vocab below>
          source:
            citation: "..."
            url: "..."
            access_date: "YYYY-MM-DD"
          reliability: <high|medium|low>
```

### Role vocabulary

| Role | Meaning |
|------|---------|
| `numerator` | Single numerator term (when no addends) |
| `numerator_part` | One of several addends that form the numerator |
| `denominator` | Denominator of the ratio |
| `addend` | A term that is summed to form the main value (no ratio structure) |
| `context` | Not in the formula; provides interpretive context |
| `uncertainty` | Standard error, confidence interval, etc. |
| `cross_country_context` | Percentile rank or comparative metric |
| `methodology_metadata` | Number of sources, survey type, revision notes |
| `confidence_bound` | Upper or lower CI bound |
| `sub_component` | A breakdown of a numerator_part (e.g., oil rents within total rents) |

---

## Per-Indicator Component Reference

### gdp_per_capita
```
formula: "gdp_current_usd / population"
```
| Component | Role | Source |
|-----------|------|--------|
| `gdp_current_usd` | numerator | shared / World Bank NY.GDP.MKTP.CD |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

---

### inflation
```
formula: "((cpi_current - cpi_prior) / cpi_prior) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `cpi_current` | numerator_part | shared.cpi (current year) |
| `cpi_prior` | denominator | shared.cpi (prior year row) |

Note: if `FP.CPI.TOTL.ZG` (direct rate) is available, use it and record CPI levels as context.

---

### unemployment
```
formula: "(unemployed_persons / labor_force_total) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `unemployed_persons` | numerator | ILO ILOSTAT UNE_TUNE_SEX_AGE_NB |
| `labor_force_total` | denominator | World Bank SL.TLF.TOTL.IN |

---

### youth_unemployment
```
formula: "(youth_unemployed / youth_labor_force) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `youth_unemployed` | numerator | ILO ILOSTAT UNE_TUNE_SEX_AGE_NB (age=15-24) |
| `youth_labor_force` | denominator | ILO ILOSTAT EAP_TEAP_SEX_AGE_NB (age=15-24) |
| `population` | context | shared / World Bank SP.POP.TOTL |

---

### trade_openness
```
formula: "((exports_usd + imports_usd) / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `exports_usd` | numerator_part | World Bank NE.EXP.GNFS.CD |
| `imports_usd` | numerator_part | World Bank NE.IMP.GNFS.CD |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |

---

### fdi
```
formula: "(fdi_net_inflows_usd / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `fdi_net_inflows_usd` | numerator | World Bank BX.KLT.DINV.CD.WD |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |

---

### fiscal_health
```
formula: "gross_debt_usd / gdp_usd_nominal * 100  (IMF provides this directly as GGXWDG_NGDP)"
```
| Component | Role | Source |
|-----------|------|--------|
| `gross_debt_pct_gdp` | numerator | IMF WEO GGXWDG_NGDP |
| `budget_balance_pct_gdp` | context | IMF WEO GGXCNL_NGDP |

Note: IMF WEO provides the ratio directly; store the ratio as main value and both WEO series as components.

---

### refugee_flows
```
formula: "((refugees + idps) / population) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `refugees` | numerator_part | UNHCR Refugee Data Finder (country of origin) |
| `idps` | numerator_part | IDMC Internal Displacement Database |
| `asylum_seekers` | context | UNHCR |
| `returnees` | context | UNHCR (reduction signal) |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

---

### political_violence
```
formula: "conflict_deaths (raw count; per_100k = conflict_deaths / population * 100000)"
```
| Component | Role | Source |
|-----------|------|--------|
| `conflict_deaths` | numerator | UCDP GED (best estimate) |
| `conflict_deaths_low` | uncertainty | UCDP GED (low estimate) |
| `conflict_deaths_high` | uncertainty | UCDP GED (high estimate) |
| `population` | context | shared / World Bank SP.POP.TOTL |

---

### net_migration
```
formula: "(sm_pop_netm_5yr_sum / 5) / population * 1000"
```
| Component | Role | Source |
|-----------|------|--------|
| `net_migration_5yr_sum` | numerator | World Bank SM.POP.NETM |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

Note: SM.POP.NETM is a 5-year sum; divide by 5 for annual. The value for year Y covers Y-4 to Y.

---

### emigration_rate
```
formula: "(emigrant_stock_change / population) * 100"
where emigrant_stock_change = emigrant_stock_t1 - emigrant_stock_t0
```
| Component | Role | Source |
|-----------|------|--------|
| `emigrant_stock_t1` | numerator_part | UN DESA International Migrant Stock (origin table) |
| `emigrant_stock_t0` | numerator_part | UN DESA (prior observation) |
| `population` | denominator | shared / World Bank SP.POP.TOTL |
| `years_between_observations` | methodology_metadata | for annualizing the change |

---

### immigration_rate
```
formula: "(immigrant_stock_change / population) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `immigrant_stock_t1` | numerator_part | UN DESA International Migrant Stock (destination table) |
| `immigrant_stock_t0` | numerator_part | UN DESA (prior observation) |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

---

### remittances
```
formula: "(remittances_received_usd / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `remittances_received_usd` | numerator | World Bank BX.TRF.PWKR.CD.DT |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |

---

### brain_drain
```
formula: "(tertiary_educated_emigrants / total_tertiary_educated_nationals) * 100"
where total = domestic_tertiary_stock + tertiary_educated_emigrants
```
| Component | Role | Source |
|-----------|------|--------|
| `tertiary_educated_emigrants` | numerator | OECD DIOC (high education column, all destinations) |
| `domestic_tertiary_stock` | denominator_part | UNESCO UIS (tertiary enrollment or attainment stock) |
| `total_tertiary_nationals` | denominator | computed: emigrants + domestic stock |

---

### military_expenditure
```
formula: "(military_expenditure_usd / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `military_expenditure_usd` | numerator | SIPRI MILEX "Current USD" sheet |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |
| `military_expenditure_pct_govt` | context | SIPRI MILEX "Share of Govt. Expenditure" |
| `sipri_footnote_code` | methodology_metadata | SIPRI cell footnote (xx = estimate, xxx = missing) |

---

### natural_resource_rents
```
formula: "oil_rents + gas_rents + coal_rents + mineral_rents + forest_rents"
(each already as % GDP; additive)
```
| Component | Role | Source |
|-----------|------|--------|
| `oil_rents_pct_gdp` | addend | World Bank NY.GDP.PETR.RT.ZS |
| `gas_rents_pct_gdp` | addend | World Bank NY.GDP.NGAS.RT.ZS |
| `coal_rents_pct_gdp` | addend | World Bank NY.GDP.COAL.RT.ZS |
| `mineral_rents_pct_gdp` | addend | World Bank NY.GDP.MINR.RT.ZS |
| `forest_rents_pct_gdp` | addend | World Bank NY.GDP.FRST.RT.ZS |

All five sub-components must be collected. The sum should equal the main value (NY.GDP.TOTL.RT.ZS);
verify and note any discrepancy.

---

### total_population
```
formula: "SP.POP.TOTL (raw count — no formula; store breakdown as components)"
```
| Component | Role | Source |
|-----------|------|--------|
| `population_male` | sub_component | World Bank SP.POP.TOTL.MA.IN |
| `population_female` | sub_component | World Bank SP.POP.TOTL.FE.IN |
| `population_0_14` | sub_component | World Bank SP.POP.0014.TO |
| `population_15_64` | sub_component | World Bank SP.POP.1564.TO |
| `population_65plus` | sub_component | World Bank SP.POP.65UP.TO |
| `population_growth_rate` | context | World Bank SP.POP.GROW |

---

### working_age_population
```
formula: "(working_age_15_64 / total_population) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `working_age_15_64` | numerator | World Bank SP.POP.1564.TO |
| `total_population` | denominator | shared / World Bank SP.POP.TOTL |
| `working_age_15plus` | context | World Bank SP.POP.15UP.TO (broader measure) |

---

### labor_force_participation
```
formula: "(labor_force_total / working_age_population_15plus) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `labor_force_total` | numerator | ILO ILOSTAT EAP_TEAP_SEX_AGE_NB (15+) |
| `working_age_population_15plus` | denominator | World Bank SP.POP.15UP.TO |
| `labor_force_male` | sub_component | ILO EAP_TEAP_SEX_AGE_NB (male) |
| `labor_force_female` | sub_component | ILO EAP_TEAP_SEX_AGE_NB (female) |

---

### employment
```
formula: "(employed_persons / working_age_population_15plus) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `employed_persons` | numerator | ILO ILOSTAT EMP_TEMP_SEX_AGE_NB (15+) |
| `working_age_population_15plus` | denominator | World Bank SP.POP.15UP.TO |
| `employed_wage_salary` | sub_component | ILO EMP_TEMP_SEX_STE_NB (status=wage+salaried) |
| `employed_self` | sub_component | ILO EMP_TEMP_SEX_STE_NB (status=self-employed) |
| `employed_contributing_family` | sub_component | ILO EMP_TEMP_SEX_STE_NB (contributing family) |

---

### informal_economy
```
formula: "(informal_employed / total_employed) * 100  [employment measure]
       OR shadow_economy_pct_gdp  [output measure — separate main value]"
```
| Component | Role | Source |
|-----------|------|--------|
| `informal_employed` | numerator | ILO ILOSTAT EMP_2EMP_SEX_ECO_NB (informal) |
| `total_employed` | denominator | ILO ILOSTAT EMP_TEMP_SEX_AGE_NB |
| `self_employed_pct` | context | World Bank SL.EMP.SELF.ZS (proxy if ILO unavailable) |
| `shadow_economy_pct_gdp` | context | IMF/Schneider estimates (different metric) |

---

### life_expectancy
```
formula: "weighted_avg(le_male, le_female) by sex ratio — WB provides combined directly"
```
| Component | Role | Source |
|-----------|------|--------|
| `life_expectancy_male` | sub_component | World Bank SP.DYN.LE00.MA.IN |
| `life_expectancy_female` | sub_component | World Bank SP.DYN.LE00.FE.IN |

---

### infant_mortality
```
formula: "(infant_deaths / live_births) * 1000  — WB provides rate directly"
```
| Component | Role | Source |
|-----------|------|--------|
| `neonatal_mortality_rate` | sub_component | World Bank SH.DYN.NMRT (deaths <28 days per 1,000) |
| `under5_mortality_rate` | context | World Bank SH.DYN.MORT |

---

### internet_users
```
formula: "(internet_users_count / population) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `internet_users_count` | numerator | World Bank IT.NET.USER.NB (or ITU) |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

---

### mobile_subscriptions
```
formula: "(mobile_subscriptions_total / population) * 100"
(note: can exceed 100 due to multiple SIMs per person)
```
| Component | Role | Source |
|-----------|------|--------|
| `mobile_subscriptions_total` | numerator | World Bank IT.CEL.SETS |
| `population` | denominator | shared / World Bank SP.POP.TOTL |

---

### health_expenditure
```
formula: "(health_expenditure_usd / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `health_expenditure_usd` | numerator | World Bank SH.XPD.CHEX.CD |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |
| `public_health_pct_gdp` | sub_component | World Bank SH.XPD.GHED.GD.ZS |
| `out_of_pocket_pct_current` | context | World Bank SH.XPD.OOPC.CH.ZS |

---

### education_expenditure
```
formula: "(education_expenditure_usd / gdp_current_usd) * 100"
```
| Component | Role | Source |
|-----------|------|--------|
| `education_expenditure_usd` | numerator | derived: SE.XPD.TOTL.GD.ZS × NY.GDP.MKTP.CD / 100 |
| `gdp_current_usd` | denominator | shared / World Bank NY.GDP.MKTP.CD |
| `education_pct_govt_budget` | context | World Bank SE.XPD.TOTL.GB.ZS |

---

### gini
```
formula: "derived from Lorenz curve (household survey); WB publishes result directly"
(no simple component decomposition; record metadata components)
```
| Component | Role | Source |
|-----------|------|--------|
| `survey_year` | methodology_metadata | WB footnote (actual survey year, may differ from reporting year) |
| `income_or_consumption` | methodology_metadata | WB footnote ("income" or "consumption" basis) |
| `income_share_bottom_20` | context | World Bank SI.DST.FRST.20 |
| `income_share_top_20` | context | World Bank SI.DST.05TH.20 |
| `poverty_headcount_215` | context | World Bank SI.POV.DDAY (% below $2.15/day) |

---

### political_stability / government_effectiveness / control_of_corruption (WGI)
```
formula: "UCM_weighted_average(governance_surveys) — not decomposable from public data"
(record metadata components for audit trail)
```
| Component | Role | Source |
|-----------|------|--------|
| `standard_error` | uncertainty | World Bank WGI <dim>.STD |
| `percentile_rank` | cross_country_context | World Bank WGI <dim>.PER.RNK |
| `number_of_sources` | methodology_metadata | World Bank WGI <dim>.NO.SRC |
| `percentile_rank_lower_ci` | confidence_bound | World Bank WGI <dim>.PER.RNK.LOWER |
| `percentile_rank_upper_ci` | confidence_bound | World Bank WGI <dim>.PER.RNK.UPPER |

---

## Indicators Without Formula Components

These are **pure indices or qualitative ordinal scales** with no numerator/denominator.
Do NOT attempt to fabricate components. Instead record any available metadata:

| Indicator | Type | Metadata worth recording |
|-----------|------|--------------------------|
| `civil_liberties` | Freedom House ordinal 1–7 | — |
| `press_freedom` | RSF composite 0–100 | methodology_version, country_analyst note |
| `budget_transparency` | OBI composite 0–100 | survey round year |
| `statistical_transparency` | WB SCI composite 0–100 | — (discontinued 2021) |
| `legal_transparency` | WJP composite 0–1 | survey year |
| `extractive_transparency` | EITI categorical | validation_date, corrective_actions |
| `territorial_control` | qualitative assessment | sources cited in qualitative block |
| `institutional_functioning` | qualitative assessment | same |
| `elite_cohesion` | qualitative assessment | same |
| `sanctions` | qualitative ordinal | specific sanction lists cited |
| `diplomatic_integration` | qualitative ordinal | same |
| `foreign_military` | qualitative ordinal | same |

---

## YAML Example (complete)

`fdi` for Iraq 2005:

```yaml
  2005:
    data_status: complete
    quantitative:
      value: 2.14              # FDI net inflows as % of GDP
      unit: percent_gdp
      formula: "(fdi_net_inflows_usd / gdp_current_usd) * 100"
      source:
        citation: "World Bank WDI, BX.KLT.DINV.WD.GD.ZS, Iraq, 2005, accessed 2026-03-02"
        url: "https://data.worldbank.org/indicator/BX.KLT.DINV.WD.GD.ZS"
        access_date: "2026-03-02"
      reliability: medium
      components:
        fdi_net_inflows_usd:
          value: 514000000
          unit: usd_current
          role: numerator
          source:
            citation: "World Bank WDI, BX.KLT.DINV.CD.WD, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/BX.KLT.DINV.CD.WD"
            access_date: "2026-03-02"
          reliability: medium
        gdp_current_usd:
          shared_ref: gdp_current_usd   # value is in shared/base_variables.yaml
          role: denominator
```

`natural_resource_rents` for Iraq 2005:

```yaml
  2005:
    data_status: complete
    quantitative:
      value: 58.4
      unit: percent_gdp
      formula: "oil_rents_pct_gdp + gas_rents_pct_gdp + coal_rents_pct_gdp + mineral_rents_pct_gdp + forest_rents_pct_gdp"
      source:
        citation: "World Bank WDI, NY.GDP.TOTL.RT.ZS, Iraq, 2005, accessed 2026-03-02"
        url: "https://data.worldbank.org/indicator/NY.GDP.TOTL.RT.ZS"
        access_date: "2026-03-02"
      reliability: high
      components:
        oil_rents_pct_gdp:
          value: 57.9
          unit: percent_gdp
          role: addend
          source:
            citation: "World Bank WDI, NY.GDP.PETR.RT.ZS, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.PETR.RT.ZS"
            access_date: "2026-03-02"
          reliability: high
        gas_rents_pct_gdp:
          value: 0.3
          unit: percent_gdp
          role: addend
          source:
            citation: "World Bank WDI, NY.GDP.NGAS.RT.ZS, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.NGAS.RT.ZS"
            access_date: "2026-03-02"
          reliability: high
        coal_rents_pct_gdp:
          value: 0.0
          unit: percent_gdp
          role: addend
          source:
            citation: "World Bank WDI, NY.GDP.COAL.RT.ZS, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.COAL.RT.ZS"
            access_date: "2026-03-02"
          reliability: high
        mineral_rents_pct_gdp:
          value: 0.2
          unit: percent_gdp
          role: addend
          source:
            citation: "World Bank WDI, NY.GDP.MINR.RT.ZS, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.MINR.RT.ZS"
            access_date: "2026-03-02"
          reliability: high
        forest_rents_pct_gdp:
          value: 0.0
          unit: percent_gdp
          role: addend
          source:
            citation: "World Bank WDI, NY.GDP.FRST.RT.ZS, Iraq, 2005, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.FRST.RT.ZS"
            access_date: "2026-03-02"
          reliability: high
```

---

## Session Workflow

1. **First**: Collect `shared/base_variables.yaml` for the entire time range (population, GDP, CPI, working_age_population)
2. **Then**: For each indicator, collect the main value + all components per the reference table above
3. **For shared components**: write `shared_ref: <variable_name>` in the component block
4. **For non-shared components**: enter value + source inline
5. **Always**: include `formula` in the `quantitative` block
6. **Always**: check World Bank footnotes and note relevant ones in `qualitative.notes`
